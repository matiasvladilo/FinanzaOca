/**
 * GET /api/informes/cron
 * Endpoint para disparadores de cron programados (Vercel, Netlify o externo).
 *
 * Query params:
 *   type    "daily" | "weekly" | "monthly"
 *   secret  CRON_SECRET (requerido para autorización)
 *
 * Env vars requeridas:
 *   CRON_SECRET            Token secreto para autorizar la llamada
 *   REPORT_RECIPIENTS      Lista de emails separados por coma
 *   RESEND_API_KEY         API key de Resend (usada por /send-email)
 *   RESEND_FROM            Dirección remitente (usada por /send-email)
 *   NEXT_PUBLIC_BASE_URL   Base URL de la app (default: http://localhost:3000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { toLocalISODate } from '@/lib/date-utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type CronType = 'daily' | 'weekly' | 'monthly';

interface DateRange {
  fechaDesde: string;
  fechaHasta: string;
}

interface GenerateResponse {
  ok: boolean;
  error?: string;
  filters?: { fechaDesde: string; fechaHasta: string; sucursal: string };
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  deltaVentas?: number;
  deltaGastos?: number;
  deltaMargen?: number;
  insights?: unknown[];
  [key: string]: unknown;
}

interface AiAnalysisResponse {
  ok: boolean;
  error?: string;
  analysis?: Record<string, unknown>;
}

interface SendEmailResponse {
  ok: boolean;
  error?: string;
  messageId?: string;
}

// ── Cálculo de rango de fechas según tipo de cron ────────────────────────────

function buildCronDateRange(type: CronType): DateRange {
  const now = new Date();
  // Usar hora local (Chile UTC-3/4)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  switch (type) {
    case 'daily': {
      // Ayer
      const ayer = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const fechaStr = toLocalISODate(ayer);
      return { fechaDesde: fechaStr, fechaHasta: fechaStr };
    }

    case 'weekly': {
      // Semana anterior completa: lunes–domingo
      const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
      const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
      const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;

      const lastMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysToLastMonday);
      const lastSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysToLastSunday);

      return {
        fechaDesde: toLocalISODate(lastMonday),
        fechaHasta: toLocalISODate(lastSunday),
      };
    }

    case 'monthly': {
      // Mes anterior completo: primer y último día del mes anterior
      const primerDia = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const ultimoDia = new Date(today.getFullYear(), today.getMonth(), 0); // día 0 = último del mes anterior

      return {
        fechaDesde: toLocalISODate(primerDia),
        fechaHasta: toLocalISODate(ultimoDia),
      };
    }

    default: {
      // Fallback: ayer
      const ayer = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      const fechaStr = toLocalISODate(ayer);
      return { fechaDesde: fechaStr, fechaHasta: fechaStr };
    }
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type   = (searchParams.get('type') ?? 'daily') as CronType;
    const secret = searchParams.get('secret') ?? '';

    // 1. Validar token secreto
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[cron] CRON_SECRET no está configurado');
      return NextResponse.json(
        { ok: false, error: 'Endpoint de cron no configurado' },
        { status: 500 },
      );
    }
    if (secret !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado' },
        { status: 401 },
      );
    }

    // 2. Validar tipo
    const validTypes: CronType[] = ['daily', 'weekly', 'monthly'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { ok: false, error: `Tipo inválido: "${type}". Use daily, weekly o monthly.` },
        { status: 400 },
      );
    }

    // 3. Leer destinatarios desde variables de entorno
    const parseEmails = (raw: string) =>
      raw.split(',').map(r => r.trim()).filter(r => r.length > 0 && r.includes('@'));

    const recipientsUsuario = parseEmails(process.env.REPORT_RECIPIENTS ?? '');
    const recipientsAdmin   = parseEmails(process.env.REPORT_RECIPIENTS_ADMIN ?? '');

    if (recipientsUsuario.length === 0 && recipientsAdmin.length === 0) {
      console.warn('[cron] No hay destinatarios configurados');
      return NextResponse.json(
        { ok: false, error: 'No hay destinatarios configurados (REPORT_RECIPIENTS o REPORT_RECIPIENTS_ADMIN)' },
        { status: 500 },
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // 4. Determinar rango de fechas
    const dateRange = buildCronDateRange(type);
    console.log(`[cron] Ejecutando informe ${type} para ${dateRange.fechaDesde} → ${dateRange.fechaHasta}`);

    // 5. Obtener datos del informe
    const generateUrl = new URL(`${baseUrl}/api/informes/generate`);
    generateUrl.searchParams.set('fechaDesde', dateRange.fechaDesde);
    generateUrl.searchParams.set('fechaHasta', dateRange.fechaHasta);
    generateUrl.searchParams.set('tipo', type);

    // Generamos siempre con rol admin para obtener el reporte completo (incl. gastoFijo).
    // Luego quitamos gastoFijoData antes de enviar a destinatarios no-admin.
    const generateRes = await fetch(generateUrl.toString(), {
      headers: { 'x-cron-secret': cronSecret, 'x-cron-role': 'admin' },
    });
    if (!generateRes.ok) {
      const errText = await generateRes.text();
      console.error('[cron] Error al generar informe:', errText);
      return NextResponse.json(
        { ok: false, error: `Error al generar informe: ${generateRes.status}` },
        { status: 502 },
      );
    }

    const reportData = (await generateRes.json()) as GenerateResponse;
    if (!reportData.ok) {
      return NextResponse.json(
        { ok: false, error: reportData.error ?? 'Error desconocido en generate' },
        { status: 502 },
      );
    }

    // 6. Análisis IA (best-effort: si falla no detiene el envío)
    let aiAnalysis: Record<string, unknown> | undefined;
    try {
      const aiRes = await fetch(`${baseUrl}/api/informes/ai-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters:      reportData.filters,
          current:      reportData.current,
          previous:     reportData.previous,
          deltaVentas:  reportData.deltaVentas,
          deltaGastos:  reportData.deltaGastos,
          deltaMargen:  reportData.deltaMargen,
          insights:     reportData.insights,
        }),
      });

      if (aiRes.ok) {
        const aiData = (await aiRes.json()) as AiAnalysisResponse;
        if (aiData.ok && aiData.analysis) {
          aiAnalysis = aiData.analysis;
          console.log('[cron] Análisis IA generado correctamente');
        }
      } else {
        console.warn('[cron] AI analysis retornó error HTTP:', aiRes.status);
      }
    } catch (aiErr) {
      console.warn('[cron] No se pudo obtener análisis IA (continúa sin él):', aiErr);
    }

    // 7. Enviar emails según rol del destinatario
    const typeLabels: Record<CronType, string> = {
      daily:   'Diario',
      weekly:  'Semanal',
      monthly: 'Mensual',
    };

    const dateLabel = type === 'daily'
      ? dateRange.fechaDesde
      : `${dateRange.fechaDesde} al ${dateRange.fechaHasta}`;
    const subject = `Nuevo informe ${typeLabels[type].toLowerCase()} de La Oca — ${dateLabel}`;

    const fullReport   = { ...reportData, aiAnalysis };
    // Para no-admin: quitamos gastoFijoData
    const { gastoFijoData: _gf, ...reportSinGastoFijo } = fullReport as typeof fullReport & { gastoFijoData?: unknown };
    void _gf;

    const sendEmail = async (recipients: string[], data: unknown) => {
      const res = await fetch(`${baseUrl}/api/informes/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject, reportData: data }),
      });
      return res.json() as Promise<SendEmailResponse>;
    };

    const results: SendEmailResponse[] = [];

    if (recipientsAdmin.length > 0) {
      const r = await sendEmail(recipientsAdmin, fullReport);
      if (!r.ok) console.error('[cron] Error enviando a admins:', r.error);
      else console.log(`[cron] Informe (admin) enviado a ${recipientsAdmin.length} destinatario(s)`);
      results.push(r);
    }

    if (recipientsUsuario.length > 0) {
      const r = await sendEmail(recipientsUsuario, reportSinGastoFijo);
      if (!r.ok) console.error('[cron] Error enviando a usuarios:', r.error);
      else console.log(`[cron] Informe (usuario) enviado a ${recipientsUsuario.length} destinatario(s)`);
      results.push(r);
    }

    const anyFailed = results.some(r => !r.ok);
    if (anyFailed && results.every(r => !r.ok)) {
      return NextResponse.json(
        { ok: false, error: 'Todos los envíos fallaron' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      type,
      fechaDesde: dateRange.fechaDesde,
      fechaHasta: dateRange.fechaHasta,
      sentAdmin:   recipientsAdmin.length,
      sentUsuario: recipientsUsuario.length,
      hasAiAnalysis: !!aiAnalysis,
      executedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[cron] Error inesperado:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
