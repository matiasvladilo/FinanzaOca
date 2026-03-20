/**
 * POST /api/informes/send-email
 * Envía el informe de gestión por correo a los destinatarios indicados.
 *
 * Body: { recipients: string[], reportData: object, subject?: string }
 * Response: { ok: true, messageId: string } | { ok: false, error: string }
 */

import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SucursalMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  transacciones: number;
}

interface PeriodMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  margenPct: number;
  transacciones: number;
  ticketPromedio: number;
  porSucursal: Record<string, SucursalMetrics>;
  topProveedores: Array<{ nombre: string; monto: number; pct: number }>;
}

interface Insight {
  type: 'positive' | 'negative' | 'warning';
  severity: string;
  titulo: string;
  descripcion: string;
  accion?: string;
}

interface AiAnalysis {
  resumen?: string;
  comparacion?: string;
  problemas?: string[];
  recomendaciones?: string[];
}

interface ReportData {
  filters: {
    fechaDesde: string;
    fechaHasta: string;
    sucursal?: string;
  };
  generatedAt?: string;
  current: PeriodMetrics;
  previous?: PeriodMetrics;
  deltaVentas?: number;
  deltaGastos?: number;
  deltaMargen?: number;
  tendencia?: 'up' | 'down' | 'flat';
  insights?: Insight[];
  aiAnalysis?: AiAnalysis;
}

interface SendEmailBody {
  recipients: string[];
  reportData: ReportData;
  subject?: string;
}

// ── Formato de moneda chilena ─────────────────────────────────────────────────

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPct(n: number, showSign = false): string {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function tendenciaEmoji(t?: 'up' | 'down' | 'flat'): string {
  if (t === 'up')   return '&#9650;'; // ▲
  if (t === 'down') return '&#9660;'; // ▼
  return '&#9654;'; // ►
}

function insightColor(type: Insight['type']): string {
  if (type === 'positive') return '#16a34a';
  if (type === 'negative') return '#dc2626';
  return '#d97706';
}

function insightBg(type: Insight['type']): string {
  if (type === 'positive') return '#f0fdf4';
  if (type === 'negative') return '#fef2f2';
  return '#fffbeb';
}

// ── Construcción del HTML del email ──────────────────────────────────────────

function buildEmailHtml(reportData: ReportData): string {
  const { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, tendencia, insights, aiAnalysis, generatedAt } = reportData;
  const sucursalLabel = filters.sucursal ? `Sucursal: ${filters.sucursal}` : 'Todas las sucursales';
  const generadoLabel = generatedAt ? new Date(generatedAt).toLocaleString('es-CL') : new Date().toLocaleString('es-CL');

  const deltaVentasStr = deltaVentas != null ? formatPct(deltaVentas, true) : '—';
  const deltaGastosStr = deltaGastos != null ? formatPct(deltaGastos, true) : '—';
  const deltaMargenStr = deltaMargen != null ? formatPct(deltaMargen, true) : '—';

  const deltaVentasColor = (deltaVentas ?? 0) >= 0 ? '#16a34a' : '#dc2626';
  const deltaGastosColor = (deltaGastos ?? 0) <= 0 ? '#16a34a' : '#dc2626';
  const deltaMargenColor = (deltaMargen ?? 0) >= 0 ? '#16a34a' : '#dc2626';

  // Filas por sucursal
  const sucursalRows = Object.entries(current.porSucursal)
    .sort(([, a], [, b]) => b.ventas - a.ventas)
    .map(([nombre, d]) => {
      const prevSuc = previous?.porSucursal?.[nombre];
      const delta = prevSuc && prevSuc.ventas > 0
        ? ((d.ventas - prevSuc.ventas) / prevSuc.ventas) * 100
        : null;
      const deltaCell = delta != null
        ? `<span style="color:${delta >= 0 ? '#16a34a' : '#dc2626'};font-weight:600">${formatPct(delta, true)}</span>`
        : '—';
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${nombre}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${formatCLP(d.ventas)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${formatCLP(d.gastos)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${formatCLP(d.margen)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right">${deltaCell}</td>
        </tr>`;
    }).join('');

  // Insights
  const insightItems = (insights ?? []).slice(0, 6).map(ins => `
    <div style="margin-bottom:10px;padding:12px 14px;background:${insightBg(ins.type)};border-left:4px solid ${insightColor(ins.type)};border-radius:4px">
      <div style="font-weight:600;font-size:13px;color:${insightColor(ins.type)};margin-bottom:4px">${ins.titulo}</div>
      <div style="font-size:12px;color:#374151">${ins.descripcion}</div>
      ${ins.accion ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;font-style:italic">&#128204; ${ins.accion}</div>` : ''}
    </div>`).join('');

  // Sección IA
  const aiSection = aiAnalysis ? `
    <div style="margin-top:32px">
      <h2 style="font-size:16px;font-weight:700;color:#1f2937;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:16px">
        Análisis Ejecutivo
      </h2>
      ${aiAnalysis.resumen ? `<p style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:12px">${aiAnalysis.resumen}</p>` : ''}
      ${aiAnalysis.comparacion ? `<p style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:16px">${aiAnalysis.comparacion}</p>` : ''}
      ${(aiAnalysis.problemas?.length ?? 0) > 0 ? `
        <div style="margin-bottom:16px">
          <div style="font-weight:600;font-size:13px;color:#dc2626;margin-bottom:8px">Puntos a Atender</div>
          <ul style="margin:0;padding-left:18px">
            ${(aiAnalysis.problemas ?? []).map(p => `<li style="font-size:13px;color:#374151;margin-bottom:4px">${p}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${(aiAnalysis.recomendaciones?.length ?? 0) > 0 ? `
        <div>
          <div style="font-weight:600;font-size:13px;color:#16a34a;margin-bottom:8px">Recomendaciones</div>
          <ol style="margin:0;padding-left:18px">
            ${(aiAnalysis.recomendaciones ?? []).map(r => `<li style="font-size:13px;color:#374151;margin-bottom:4px">${r}</li>`).join('')}
          </ol>
        </div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Informe FinanzasOca</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="max-width:680px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:28px 32px">
      <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
        ${tendenciaEmoji(tendencia)} Informe FinanzasOca
      </div>
      <div style="font-size:14px;color:#bfdbfe;margin-top:6px">
        ${filters.fechaDesde} — ${filters.fechaHasta} &nbsp;·&nbsp; ${sucursalLabel}
      </div>
      <div style="font-size:12px;color:#93c5fd;margin-top:4px">Generado: ${generadoLabel}</div>
    </div>

    <!-- KPIs principales -->
    <div style="padding:24px 32px">
      <h2 style="font-size:16px;font-weight:700;color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-top:0;margin-bottom:16px">
        Resumen del Período
      </h2>

      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#e5e7eb">
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Métrica</th>
            <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">Período Actual</th>
            <th style="padding:10px 14px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em">vs Anterior</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827">Ventas Totales</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;color:#111827">${formatCLP(current.ventas)}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;color:${deltaVentasColor}">${deltaVentasStr}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151">Gastos Totales</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#374151">${formatCLP(current.gastos)}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;color:${deltaGastosColor}">${deltaGastosStr}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:600;color:#111827">Margen Bruto</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;color:#111827">${formatCLP(current.margen)} <span style="font-size:11px;color:#6b7280">(${current.margenPct.toFixed(1)}%)</span></td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:600;color:${deltaMargenColor}">${deltaMargenStr}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151">Transacciones</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#374151">${current.transacciones.toLocaleString('es-CL')}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right"></td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-size:13px;color:#374151">Ticket Promedio</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right;color:#374151">${formatCLP(current.ticketPromedio)}</td>
            <td style="padding:10px 14px;font-size:13px;text-align:right"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Por sucursal -->
    ${Object.keys(current.porSucursal).length > 0 ? `
    <div style="padding:0 32px 24px">
      <h2 style="font-size:16px;font-weight:700;color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-top:0;margin-bottom:16px">
        Por Sucursal
      </h2>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#e5e7eb">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Sucursal</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Ventas</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Gastos</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Margen</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Δ Ventas</th>
          </tr>
        </thead>
        <tbody>
          ${sucursalRows}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Alertas e insights -->
    ${(insights?.length ?? 0) > 0 ? `
    <div style="padding:0 32px 24px">
      <h2 style="font-size:16px;font-weight:700;color:#1f2937;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-top:0;margin-bottom:16px">
        Alertas y Observaciones
      </h2>
      ${insightItems}
    </div>` : ''}

    <!-- Análisis IA -->
    ${aiSection ? `<div style="padding:0 32px 24px">${aiSection}</div>` : ''}

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
        Este informe fue generado automáticamente por FinanzasOca Dashboard.<br>
        Período: ${filters.fechaDesde} al ${filters.fechaHasta}
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SendEmailBody;
    const { recipients, reportData, subject } = body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere al menos un destinatario en "recipients"' },
        { status: 400 },
      );
    }

    if (!reportData) {
      return NextResponse.json(
        { ok: false, error: 'Se requiere "reportData" en el body' },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'RESEND_API_KEY no configurado en variables de entorno' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const { filters } = reportData;
    const defaultSubject = `Informe FinanzasOca — ${filters.fechaDesde} al ${filters.fechaHasta}${filters.sucursal ? ` · ${filters.sucursal}` : ''}`;
    const emailSubject = subject ?? defaultSubject;

    const html = buildEmailHtml(reportData);

    const from = process.env.RESEND_FROM ?? 'informes@finanzasoca.cl';

    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject: emailSubject,
      html,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, messageId: data?.id ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
