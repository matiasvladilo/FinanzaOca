/**
 * POST /api/asistente/chat
 * Endpoint del asistente virtual — solo admin. Corre un loop de tool-calling
 * con Claude: si la respuesta trae tool_use, ejecuta la función real y le
 * devuelve el resultado, hasta que Claude contesta en texto o se llega al
 * tope de iteraciones.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { requireAuth } from '@/lib/auth-api';
import { buildSystemPrompt } from '@/lib/asistente/prompt';
import { ASISTENTE_TOOLS } from '@/lib/asistente/tools';
import { ASISTENTE_HANDLERS } from '@/lib/asistente/handlers';
import { normalizeLocalName } from '@/lib/data/parsers';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOOL_ITERATIONS = 5;
const MAX_MENSAJE_LARGO = 2000;
const MAX_HISTORIAL_MENSAJES = 20;

/**
 * obtener_informe_periodo es la única herramienta que se resuelve acá y no en
 * handlers.ts — llama por HTTP a /api/informes/generate con x-cron-secret,
 * reutilizando el mismo endpoint ya deployado y probado del informe por
 * correo, en vez de duplicar/refactorizar esa lógica (ver Task 6 del plan).
 */
async function obtenerInformePeriodo(input: Record<string, unknown>) {
  const fechaDesde = String(input.fechaDesde ?? '');
  const fechaHasta = String(input.fechaHasta ?? '');
  const sucursal = normalizeLocalName(String(input.sucursal ?? ''));
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!baseUrl || !cronSecret) {
    return { error: 'Falta configuración del servidor (NEXT_PUBLIC_BASE_URL o CRON_SECRET)' };
  }
  const params = new URLSearchParams({ fechaDesde, fechaHasta, tipo: 'custom' });
  if (sucursal) params.set('sucursal', sucursal);
  const res = await fetch(`${baseUrl}/api/informes/generate?${params}`, {
    headers: { 'x-cron-secret': cronSecret, 'x-cron-role': 'admin' },
  });
  const body = await res.json();
  if (!body.ok) return { error: body.error ?? 'Error generando el informe' };
  // Recortado: el informe completo trae proyección, insights detallados, etc.
  // que no hacen falta para responder preguntas de chat y sólo inflarían el
  // contexto — nos quedamos con lo que el asistente realmente necesita.
  return {
    current: body.current,
    previous: body.previous,
    deltaVentas: body.deltaVentas,
    deltaGastos: body.deltaGastos,
    deltaMargen: body.deltaMargen,
    insights: body.insights,
  };
}

async function ejecutarHerramienta(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (name === 'obtener_informe_periodo') {
    try {
      return await obtenerInformePeriodo(input);
    } catch (err) {
      console.error('[asistente] Error en herramienta obtener_informe_periodo:', err);
      return { error: 'No se pudo generar el informe ahora mismo.' };
    }
  }
  const handler = ASISTENTE_HANDLERS[name];
  if (!handler) return { error: `Herramienta desconocida: ${name}` };
  try {
    return await handler(input);
  } catch (err) {
    console.error(`[asistente] Error en herramienta ${name}:`, err);
    return { error: 'No se pudo consultar ese dato ahora mismo.' };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY no configurado' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const entrada: Array<{ role: 'user' | 'assistant'; content: string }> = body?.messages ?? [];
    if (!Array.isArray(entrada) || entrada.length === 0) {
      return NextResponse.json({ ok: false, error: 'Se requiere "messages"' }, { status: 400 });
    }

    // Validar cada mensaje del historial ANTES de recortar — así no se cuela
    // silenciosamente un mensaje con content no-string (ej. un tool_use/tool_result
    // armado a mano) ni uno demasiado largo que quedaría fuera del slice de abajo.
    for (const m of entrada) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
        return NextResponse.json({ ok: false, error: 'Mensaje con "role" inválido' }, { status: 400 });
      }
      if (typeof m.content !== 'string') {
        return NextResponse.json({ ok: false, error: 'Mensaje con "content" inválido' }, { status: 400 });
      }
      if (m.content.length > MAX_MENSAJE_LARGO) {
        return NextResponse.json({ ok: false, error: `El mensaje es demasiado largo (máximo ${MAX_MENSAJE_LARGO} caracteres)` }, { status: 400 });
      }
    }

    // Tope de historial reenviado — evita que una conversación muy larga
    // infle el contexto (y el costo) indefinidamente.
    const historial = entrada.slice(-MAX_HISTORIAL_MENSAJES);

    const client = new Anthropic({ apiKey });
    const messages: MessageParam[] = historial.map(m => ({ role: m.role, content: m.content }));
    const systemPrompt = buildSystemPrompt(); // fecha de hoy fijada una vez por request

    let iteraciones = 0;
    let textoFinal = '';

    while (iteraciones < MAX_TOOL_ITERATIONS) {
      iteraciones++;
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 8000,
        system: systemPrompt,
        messages,
        tools: ASISTENTE_TOOLS,
      });

      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const textBlocks = response.content.filter(b => b.type === 'text');
      textoFinal = textBlocks.map(b => (b as { text: string }).text).join('\n').trim();

      if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
        if (response.stop_reason === 'max_tokens' && !textoFinal) {
          console.warn(`[asistente] ${auth.user.username} → corte por max_tokens sin texto final (iteración ${iteraciones})`);
        }
        break;
      }

      // Log liviano server-side: qué preguntó y qué herramientas se llamaron
      // — no se guarda en ningún lado visible al usuario, solo consola.
      console.log(`[asistente] ${auth.user.username} → herramientas: ${toolUses.map(t => (t as { name: string }).name).join(', ')}`);

      messages.push({ role: 'assistant', content: response.content });

      const resultados = await Promise.all(
        toolUses.map(async (tu) => {
          const t = tu as { id: string; name: string; input: Record<string, unknown> };
          const resultado = await ejecutarHerramienta(t.name, t.input);
          return {
            type: 'tool_result' as const,
            tool_use_id: t.id,
            content: JSON.stringify(resultado),
          };
        }),
      );
      messages.push({ role: 'user', content: resultados });
    }

    if (!textoFinal) {
      textoFinal = 'No pude terminar de procesar esa pregunta — probá reformularla o preguntá por un período más acotado.';
    }

    return NextResponse.json({ ok: true, reply: textoFinal });
  } catch (error: unknown) {
    console.error('[asistente/chat]', error);
    return NextResponse.json(
      { ok: false, error: 'No pude procesar tu consulta ahora mismo. Probá de nuevo en un momento.' },
      { status: 500 },
    );
  }
}
