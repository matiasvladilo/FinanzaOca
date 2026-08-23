/**
 * POST /api/informes/ai-analysis
 * Genera análisis ejecutivo con IA a partir de los datos del informe.
 *
 * Body: { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, insights }
 * Response: { ok: true, analysis: { resumen, comparacion, problemas, recomendaciones } }
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';

// Forzar runtime Node (no Edge) y más tiempo: la llamada a Anthropic puede
// tardar más que el default de una Edge Function.
export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Filters {
  fechaDesde: string;
  fechaHasta: string;
  sucursal?: string;
  tipo?: string;
}

interface PeriodMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  margenPct: number;
  transacciones: number;
  ticketPromedio: number;
  porSucursal: Record<string, { ventas: number; gastos: number; margen: number; transacciones: number }>;
  topProveedores: Array<{ nombre: string; monto: number; pct: number }>;
  /** Serie diaria. Se usa para detectar períodos con distinta cantidad de días con venta. */
  porDia?: Array<{ fecha: string; ventas: number; gastos: number }>;
}

interface Insight {
  type: string;
  severity: string;
  titulo: string;
  descripcion: string;
  delta?: number;
  accion?: string;
}

interface MermaTipo {
  tipo: string;
  monto: number;
  pct: number;
}

interface MermaLocal {
  local: string;
  monto: number;
  pct: number;
}

interface MermaData {
  totalMerma: number;
  porTipo: MermaTipo[];
  porLocal: MermaLocal[];
}

interface TopProducto {
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
}

interface ProduccionData {
  topProductos: TopProducto[];
  totalPedidos: number;
}

interface AnalysisRequestBody {
  filters: Filters;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaVentas: number;
  deltaGastos: number;
  deltaMargen: number;
  insights: Insight[];
  mermaData?: MermaData;
  produccionData?: ProduccionData;
}

interface AiAnalysis {
  resumen: string;
  comparacion: string;
  problemas: string[];
  recomendaciones: string[];
}

// ── Formato de pesos chilenos ─────────────────────────────────────────────────

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

function fmt(n: number): string {
  return n.toFixed(1);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Permitir llamadas internas desde el cron autenticadas con x-cron-secret
  // (igual que /api/informes/generate) — no hay sesión de usuario en una
  // llamada servidor-a-servidor disparada por la scheduled function.
  const cronHeader = req.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = !!cronSecret && cronHeader === cronSecret;

  if (!isCronCall) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
  }

  try {
    const body = (await req.json()) as AnalysisRequestBody;
    const { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, insights, mermaData, produccionData } = body;

    if (!filters || !current || !previous) {
      return NextResponse.json(
        { ok: false, error: 'Body incompleto: se requieren filters, current y previous' },
        { status: 400 },
      );
    }

    const sucursalLabel = filters.sucursal ? `sucursal "${filters.sucursal}"` : 'todas las sucursales';

    // Cobertura de cada período. Si el actual tiene menos días con venta que el
    // anterior (típico al pedir el mes en curso), comparar los totales crudos
    // exagera la caída — el modelo tiene que saberlo y decirlo.
    const diasCurr = current.porDia?.filter(d => d.ventas > 0).length ?? 0;
    const diasPrev = previous.porDia?.filter(d => d.ventas > 0).length ?? 0;
    const cobertura = (diasCurr > 0 && diasPrev > 0)
      ? `Días con venta — período actual: ${diasCurr}, período anterior: ${diasPrev}.` +
        (diasCurr < diasPrev * 0.9
          ? ` ATENCIÓN: el período actual tiene MENOS días con venta que el anterior, así que los totales NO son comparables de forma directa.` +
            ` Promedio diario actual ${formatCLP(current.ventas / diasCurr)} vs anterior ${formatCLP(previous.ventas / diasPrev)}` +
            ` (${(((current.ventas / diasCurr) / (previous.ventas / diasPrev) - 1) * 100).toFixed(1)}%).`
          : '')
      : '';
    const insightsText  = insights.map(i => `- [${i.type.toUpperCase()}/${i.severity}] ${i.titulo}: ${i.descripcion}${i.accion ? ` Acción sugerida: ${i.accion}` : ''}`).join('\n');

    // Por sucursal, con su variación vs el período anterior: sin esto el modelo
    // no puede decir "PV creció X%" y termina escribiendo generalidades.
    const sucursalesTexto = Object.entries(current.porSucursal)
      .sort(([, a], [, b]) => b.ventas - a.ventas)
      .map(([nombre, d]) => {
        const prev = previous.porSucursal?.[nombre];
        const deltaV = prev && prev.ventas > 0
          ? `${((d.ventas - prev.ventas) / prev.ventas * 100).toFixed(1)}%`
          : 's/d';
        const margenPct = d.ventas > 0 ? (d.margen / d.ventas * 100).toFixed(1) : '0.0';
        const indice60  = d.ventas > 0 ? (d.gastos / d.ventas * 100).toFixed(1) : '0.0';
        const shareVentas = current.ventas > 0 ? (d.ventas / current.ventas * 100).toFixed(1) : '0.0';
        return `  - ${nombre}: ventas ${formatCLP(d.ventas)} (${shareVentas}% del total, ${deltaV} vs período anterior)`
             + `, gastos ${formatCLP(d.gastos)}, margen ${formatCLP(d.margen)} (${margenPct}%), índice 60: ${indice60}%`
             + (prev ? ` | anterior: ventas ${formatCLP(prev.ventas)}` : '');
      })
      .join('\n');

    const topProvText = current.topProveedores
      .map(p => `  - ${p.nombre}: ${formatCLP(p.monto)} (${fmt(p.pct)}% del total gastos top)`)
      .join('\n');

    // Merma
    let mermaTexto = '  (sin datos de merma)';
    if (mermaData && mermaData.totalMerma > 0) {
      const pctSobreVentas = current.ventas > 0
        ? ((mermaData.totalMerma / current.ventas) * 100).toFixed(1)
        : '—';
      const tiposTexto = mermaData.porTipo.slice(0, 4)
        .map(t => `    - ${t.tipo}: ${formatCLP(t.monto)} (${t.pct}%)`)
        .join('\n');
      const localesTexto = mermaData.porLocal
        .map(l => `    - ${l.local}: ${formatCLP(l.monto)} (${l.pct}%)`)
        .join('\n');
      mermaTexto = `Total merma: ${formatCLP(mermaData.totalMerma)} (${pctSobreVentas}% sobre ventas)\n  Por tipo:\n${tiposTexto}\n  Por local:\n${localesTexto}`;
    }

    // Producción
    let produccionTexto = '  (sin datos de producción)';
    if (produccionData && produccionData.topProductos.length > 0) {
      const prodTexto = produccionData.topProductos.slice(0, 8)
        .map((p, i) => `    ${i + 1}. ${p.nombre} (${p.categoria}): ${p.unidades} uds — ${formatCLP(p.ingresos)}`)
        .join('\n');
      produccionTexto = `Total pedidos: ${produccionData.totalPedidos}\n  Top productos por unidades vendidas:\n${prodTexto}`;
    }

    const prompt = `Eres el analista financiero de FinanzasOca, una cadena de locales gastronómicos en Chile. Analiza los siguientes datos del período y genera un informe ejecutivo en español claro y accionable.

PERÍODO ANALIZADO: ${filters.fechaDesde} al ${filters.fechaHasta} — ${sucursalLabel}
${cobertura}

MÉTRICAS PERÍODO ACTUAL:
- Ventas totales:      ${formatCLP(current.ventas)}
- Gastos totales:      ${formatCLP(current.gastos)}
- Margen bruto:        ${formatCLP(current.margen)} (${fmt(current.margenPct)}%)
- Transacciones:       ${current.transacciones}
- Ticket promedio:     ${formatCLP(current.ticketPromedio)}

MÉTRICAS PERÍODO ANTERIOR:
- Ventas:              ${formatCLP(previous.ventas)}
- Gastos:              ${formatCLP(previous.gastos)}
- Margen:              ${formatCLP(previous.margen)} (${fmt(previous.margenPct)}%)
- Transacciones:       ${previous.transacciones}

VARIACIONES VS PERÍODO ANTERIOR:
- Δ Ventas:            ${fmt(deltaVentas)}%
- Δ Gastos:            ${fmt(deltaGastos)}%
- Δ Margen:            ${fmt(deltaMargen)}%

POR SUCURSAL (período actual):
${sucursalesTexto || '  (sin datos por sucursal)'}

TOP PROVEEDORES (período actual):
${topProvText || '  (sin datos de proveedores)'}

MERMA DEL PERÍODO:
  ${mermaTexto}

PRODUCCIÓN / TOP PRODUCTOS:
  ${produccionTexto}

ALERTAS DETECTADAS:
${insightsText || '  (sin alertas)'}

Genera un análisis ejecutivo ÚNICAMENTE en formato JSON válido con esta estructura exacta:
{
  "resumen": "1-2 oraciones con el estado general del período, con las cifras principales",
  "comparacion": "2-3 oraciones comparando con el período anterior CON NÚMEROS: cuánto varió cada cosa y qué local explica esa variación",
  "problemas": ["hallazgo puntual, con local y cifra"],
  "recomendaciones": ["acción puntual sobre un número concreto"]
}

REGLAS GENERALES:
- Escribe como un analista interno, no como un asistente: afirmaciones secas, sin adjetivos de relleno ("excelente", "notable", "es importante destacar").
- Cifras en pesos chilenos con formato "$X.XXX.XXX". Los porcentajes con un decimal.
- NO incluyas texto fuera del JSON. NO uses markdown dentro del JSON. Debe ser parseable directo.

"comparacion" — SIEMPRE con números explícitos:
- Di cuánto variaron ventas, gastos y margen: el porcentaje Y el monto ("las ventas subieron 8,4%, de $108.500.000 a $117.805.786").
- Nombra los locales que explican la variación y con qué cifra ("PV lideró con $41.200.000, 35,0% del total y +12,3% vs el mes anterior").
- Si algún local cayó, dilo con su número.
- Prohibido escribir "subieron respecto al mes pasado" sin el cuánto, o "X lideró" sin su porcentaje.
- Si arriba dice que los períodos NO son comparables por tener distinta cantidad de días, tienes que
  advertirlo en la PRIMERA oración y comparar por promedio diario, no por totales. No reportes una
  caída de X% como si fuera del negocio cuando en realidad es que el período tiene menos días.

"problemas" — hallazgos concretos, máximo 3:
- Cada uno debe nombrar el LOCAL o el ítem específico y su CIFRA. Ejemplo del nivel esperado: "La Reina tiene índice 60 en 68,2%, doce puntos sobre el umbral" o "La merma de PT fue $1.240.000, 4,1% de sus ventas, concentrada en Pastelería ($820.000)".
- Si la merma es un problema, di en qué local y de qué tipo fue la más grande, con monto.
- Nada de generalidades como "la merma se mantiene sobre el umbral esperado": eso no sirve sin el local y el número.
- Si no hay ningún hallazgo que cumpla esta vara, devuelve lista vacía. Es preferible a inventar.

"recomendaciones" — máximo 2, y SOLO si hay algo puntual que revisar:
- Solo cuando haya un número disparado, una inconsistencia o algo que no cuadre en los datos.
- Debe apuntar a un dato específico ("revisar los $3.889.597 de MIGUEL AMPUERO en La Reina: es el 4º gasto del mes y aparece solo en ese local").
- NO escribas consejos genéricos de gestión ("optimizar costos", "capacitar al personal", "monitorear la merma"). Si no hay nada puntual, devuelve lista vacía.`;

    const client = new Anthropic();

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extraer texto del primer bloque de contenido
    const rawContent = message.content[0];
    if (rawContent.type !== 'text') {
      return NextResponse.json({ ok: false, error: 'Respuesta inesperada de la IA' }, { status: 500 });
    }

    const rawText = rawContent.text.trim();

    // Parsear JSON — intentar extraer bloque JSON si hay texto extra
    let analysis: AiAnalysis;
    try {
      // Buscar primer { y último } para aislar el JSON
      const start = rawText.indexOf('{');
      const end   = rawText.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No se encontró JSON en la respuesta');
      const jsonStr = rawText.slice(start, end + 1);
      analysis = JSON.parse(jsonStr) as AiAnalysis;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'No se pudo parsear la respuesta de la IA como JSON', raw: rawText },
        { status: 500 },
      );
    }

    // Normalizar: asegurar arrays
    if (!Array.isArray(analysis.problemas))        analysis.problemas        = [];
    if (!Array.isArray(analysis.recomendaciones))  analysis.recomendaciones  = [];

    // Aplicar límites
    analysis.recomendaciones = analysis.recomendaciones.slice(0, 5);
    analysis.problemas       = analysis.problemas.slice(0, 4);

    return NextResponse.json({ ok: true, analysis });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
