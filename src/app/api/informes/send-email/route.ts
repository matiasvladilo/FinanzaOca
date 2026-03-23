/**
 * POST /api/informes/send-email
 * Envía el informe de gestión completo por correo (espeja el ReportDocument de la UI).
 *
 * Body: { recipients: string[], reportData: object, subject?: string }
 */

import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';

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
  porDia: Array<{ fecha: string; ventas: number; gastos: number }>;
}

interface Insight {
  id?: string;
  type: 'positive' | 'negative' | 'warning';
  severity?: string;
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

interface MermaLocal  { local: string; monto: number; pct: number }
interface MermaTipo   { tipo: string; monto: number; pct: number }
interface MermaData   { totalMerma: number; porLocal: MermaLocal[]; porTipo: MermaTipo[] }

interface TopProducto {
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
}
interface ProduccionData { topProductos: TopProducto[]; totalPedidos: number }

interface GastoFijoLocal {
  local: string;
  total: number;
  categorias: Array<{ categoria: string; monto: number }>;
}
interface GastoFijoData { porLocal: GastoFijoLocal[]; totalGeneral: number }

interface ReportData {
  filters: { fechaDesde: string; fechaHasta: string; sucursal?: string };
  generatedAt?: string;
  periodoAnterior?: { fechaDesde: string; fechaHasta: string };
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaVentas?: number;
  deltaGastos?: number;
  deltaMargen?: number;
  deltaTx?: number;
  tendencia?: 'up' | 'down' | 'flat';
  insights?: Insight[];
  aiAnalysis?: AiAnalysis;
  mermaData?: MermaData;
  produccionData?: ProduccionData;
  gastoFijoData?: GastoFijoData;
}

interface SendEmailBody {
  recipients: string[];
  reportData: ReportData;
  subject?: string;
}

// ── Paleta (igual que el ReportDocument de la UI) ────────────────────────────

const C = {
  bg:          '#ffffff',
  surface:     '#f8fafc',
  surfaceAlt:  '#f1f5f9',
  border:      '#e2e8f0',
  borderStrong:'#cbd5e1',
  navy:        '#0f2147',
  navyLight:   '#1e3a6e',
  blue:        '#1d4ed8',
  blueLight:   '#dbeafe',
  text:        '#0f172a',
  textSub:     '#475569',
  textMuted:   '#94a3b8',
  green:       '#059669',
  greenBg:     '#ecfdf5',
  greenBdr:    '#6ee7b7',
  red:         '#dc2626',
  redBg:       '#fff1f2',
  redBdr:      '#fecdd3',
  amber:       '#d97706',
  amberBg:     '#fffbeb',
  amberBdr:    '#fde68a',
  purple:      '#6d28d9',
  purpleBg:    '#f5f3ff',
  purpleBdr:   '#c4b5fd',
  cyan:        '#0891b2',
  cyanBg:      '#f0f9ff',
  cyanBdr:     '#bae6fd',
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number, showSign = false): string {
  const sign = showSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function fd(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function deltaColor(d: number, invertGood = false): string {
  const pos = invertGood ? d <= 0 : d >= 0;
  return pos ? C.green : C.red;
}

function deltaBadge(d: number | undefined, invertGood = false): string {
  if (d == null) return '<span style="color:#94a3b8">—</span>';
  const color = deltaColor(d, invertGood);
  const bg    = (invertGood ? d <= 0 : d >= 0) ? C.greenBg : C.redBg;
  return `<span style="display:inline-block;font-size:11px;font-weight:700;color:${color};background:${bg};padding:2px 7px;">${fmtPct(d, true)}</span>`;
}

function sectionHeader(title: string, accent: string = C.blue): string {
  return `
  <tr>
    <td colspan="10" style="padding:20px 0 10px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:4px;height:16px;background:${accent};border-radius:2px;display:inline-block;vertical-align:middle"></div>
        <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:${C.textSub};text-transform:uppercase;vertical-align:middle">${title}</span>
      </div>
      <div style="border-top:1px solid ${C.border};margin-top:8px"></div>
    </td>
  </tr>`;
}

function insightStyle(type: Insight['type']): { bg: string; bdr: string; col: string } {
  if (type === 'positive') return { bg: C.greenBg,  bdr: C.greenBdr,  col: C.green  };
  if (type === 'negative') return { bg: C.redBg,    bdr: C.redBdr,    col: C.red    };
  return                          { bg: C.amberBg,  bdr: C.amberBdr,  col: C.amber  };
}

// ── Constructor del HTML ──────────────────────────────────────────────────────

function buildEmailHtml(d: ReportData): string {
  const { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, deltaTx,
          tendencia, insights, aiAnalysis, mermaData, produccionData, gastoFijoData,
          generatedAt, periodoAnterior } = d;

  const sucursalLabel = filters.sucursal ? filters.sucursal : 'Todas las sucursales';
  const generadoLabel = generatedAt
    ? new Date(generatedAt).toLocaleString('es-CL')
    : new Date().toLocaleString('es-CL');

  const tendenciaChar = tendencia === 'up' ? '▲' : tendencia === 'down' ? '▼' : '►';

  // Índice 50
  const indice50Curr = current.ventas  > 0 ? (current.gastos  / current.ventas)  * 100 : 0;
  const indice50Prev = previous.ventas > 0 ? (previous.gastos / previous.ventas) * 100 : 0;
  const deltaIndice50 = indice50Curr - indice50Prev;
  const deltaTicket   = pctDelta(current.ticketPromedio, previous.ticketPromedio);

  const thStyle = `padding:9px 14px;font-size:10px;font-weight:700;color:${C.textSub};background:${C.surface};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${C.borderStrong};text-align:`;
  const tdStyle = `padding:10px 14px;font-size:13px;border-bottom:1px solid ${C.border};color:${C.text};`;

  // ── KPIs del período ──────────────────────────────────────────────────────
  const kpiCards = [
    { label: 'Ventas brutas',  value: fmt(current.ventas),           delta: deltaVentas,       invertGood: false, accent: C.blue   },
    { label: 'Gastos totales', value: fmt(current.gastos),           delta: deltaGastos,       invertGood: true,  accent: C.amber  },
    { label: 'Margen neto',    value: fmt(current.margen),           delta: deltaMargen,       invertGood: false, accent: C.green  },
    { label: 'Índice 50',      value: `${indice50Curr.toFixed(1)}%`, delta: -deltaIndice50,    invertGood: false, accent: indice50Curr <= 50 ? C.green : C.red },
  ].map(k => `
    <td width="25%" style="padding:4px">
      <div style="background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${k.accent};padding:14px 12px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.textMuted};text-transform:uppercase;margin-bottom:8px">${k.label}</div>
        <div style="font-size:19px;font-weight:800;color:${C.text};margin-bottom:6px;line-height:1">${k.value}</div>
        <div>${deltaBadge(k.delta, k.invertGood)}</div>
      </div>
    </td>`).join('');

  // ── Comparación de períodos ───────────────────────────────────────────────
  const prevLabel = periodoAnterior
    ? `${fd(periodoAnterior.fechaDesde)} – ${fd(periodoAnterior.fechaHasta)}`
    : 'Período anterior';

  const compRows = [
    { label: 'Ventas',           curr: fmt(current.ventas),                  prev: fmt(previous.ventas),           delta: deltaVentas,    inv: false },
    { label: 'Gastos',           curr: fmt(current.gastos),                  prev: fmt(previous.gastos),           delta: deltaGastos,    inv: true  },
    { label: 'Margen',           curr: `${fmt(current.margen)} (${current.margenPct.toFixed(1)}%)`,
                                  prev: `${fmt(previous.margen)} (${previous.margenPct.toFixed(1)}%)`, delta: deltaMargen, inv: false },
    { label: 'Índice 50',        curr: `${indice50Curr.toFixed(1)}%`,         prev: `${indice50Prev.toFixed(1)}%`,  delta: -deltaIndice50, inv: false },
    { label: 'Transacciones',    curr: current.transacciones.toLocaleString('es-CL'),
                                  prev: previous.transacciones.toLocaleString('es-CL'), delta: deltaTx, inv: false },
    { label: 'Ticket promedio',  curr: fmt(current.ticketPromedio),           prev: fmt(previous.ticketPromedio),   delta: deltaTicket,    inv: false },
  ].map((r, i) => `
    <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
      <td style="${tdStyle}font-weight:600">${r.label}</td>
      <td style="${tdStyle}text-align:right;font-weight:700">${r.curr}</td>
      <td style="${tdStyle}text-align:right;color:${C.textSub}">${r.prev}</td>
      <td style="${tdStyle}text-align:right">${deltaBadge(r.delta, r.inv)}</td>
    </tr>`).join('');

  // ── Por sucursal ──────────────────────────────────────────────────────────
  const sucursalSection = Object.keys(current.porSucursal).length > 0 ? (() => {
    const rows = Object.entries(current.porSucursal)
      .sort(([, a], [, b]) => b.ventas - a.ventas)
      .map(([nombre, data], i) => {
        const prevSuc = previous.porSucursal[nombre];
        const delta = prevSuc && prevSuc.ventas > 0 ? pctDelta(data.ventas, prevSuc.ventas) : undefined;
        const margenPct = data.ventas > 0 ? (data.margen / data.ventas) * 100 : 0;
        const indice50Suc = data.ventas > 0 ? (data.gastos / data.ventas) * 100 : 0;
        const indice50Color = indice50Suc <= 50 ? C.green : C.red;
        return `
          <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
            <td style="${tdStyle}font-weight:600">${nombre}</td>
            <td style="${tdStyle}text-align:right;font-weight:700">${fmt(data.ventas)}</td>
            <td style="${tdStyle}text-align:right;color:${C.amber}">${fmt(data.gastos)}</td>
            <td style="${tdStyle}text-align:right;color:${data.margen >= 0 ? C.green : C.red};font-weight:600">${fmt(data.margen)}</td>
            <td style="${tdStyle}text-align:right;font-size:11px;color:${C.textSub}">${margenPct.toFixed(1)}%</td>
            <td style="${tdStyle}text-align:right;font-size:11px;font-weight:700;color:${indice50Color}">${indice50Suc.toFixed(1)}%</td>
            <td style="${tdStyle}text-align:right">${deltaBadge(delta)}</td>
          </tr>`;
      }).join('');
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border}">
        ${sectionHeader('Distribución por sucursal', C.purple)}
        <tr>
          <th style="${thStyle}left">Sucursal</th>
          <th style="${thStyle}right">Ventas</th>
          <th style="${thStyle}right">Gastos</th>
          <th style="${thStyle}right">Margen</th>
          <th style="${thStyle}right">Margen %</th>
          <th style="${thStyle}right">Índice 50</th>
          <th style="${thStyle}right">Δ Ventas</th>
        </tr>
        ${rows}
      </table>`;
  })() : '';

  // ── Top proveedores ───────────────────────────────────────────────────────
  const proveedoresSection = current.topProveedores.length > 0 ? (() => {
    const rows = current.topProveedores.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td style="${tdStyle}color:${C.textMuted};font-weight:700;font-size:11px;width:30px">${i + 1}</td>
        <td style="${tdStyle}font-weight:500">${p.nombre || 'Sin nombre'}</td>
        <td style="${tdStyle}text-align:right;font-weight:700">${fmt(p.monto)}</td>
        <td style="${tdStyle}text-align:right;font-size:11px;color:${C.textSub}">${p.pct.toFixed(1)}%</td>
      </tr>`).join('');
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-top:24px">
        ${sectionHeader('Top proveedores del período', C.amber)}
        <tr>
          <th style="${thStyle}left;width:30px">#</th>
          <th style="${thStyle}left">Proveedor</th>
          <th style="${thStyle}right">Monto</th>
          <th style="${thStyle}right">% del total</th>
        </tr>
        ${rows}
      </table>`;
  })() : '';

  // ── Merma ─────────────────────────────────────────────────────────────────
  const mermaSection = (mermaData && mermaData.totalMerma > 0) ? (() => {
    const pctSobreVentas = current.ventas > 0
      ? `${((mermaData.totalMerma / current.ventas) * 100).toFixed(1)}% sobre ventas`
      : '—';
    const porLocalRows = mermaData.porLocal.map(l => `
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:${C.textSub}">${l.local}</span>
        <span style="font-weight:700">${fmt(l.monto)} <span style="color:${C.textMuted};font-weight:400">(${l.pct}%)</span></span>
      </div>`).join('');

    const tipoRows = mermaData.porTipo.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td style="${tdStyle}font-weight:500">${t.tipo}</td>
        <td style="${tdStyle}text-align:right;font-weight:700">${fmt(t.monto)}</td>
        <td style="${tdStyle}text-align:right;color:${C.textSub};font-size:11px">${t.pct.toFixed(1)}%</td>
      </tr>`).join('');

    return `
      <div style="margin-top:24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${sectionHeader('Merma del período', C.red)}
        </table>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:8px;vertical-align:top">
              <div style="background:${C.redBg};border:1px solid ${C.redBdr};padding:14px 16px">
                <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.red};text-transform:uppercase;margin-bottom:8px">Total merma</div>
                <div style="font-size:22px;font-weight:800;color:${C.text};margin-bottom:4px">${fmt(mermaData.totalMerma)}</div>
                <div style="font-size:11px;color:${C.textSub}">${pctSobreVentas}</div>
              </div>
            </td>
            <td width="50%" style="padding-left:8px;vertical-align:top">
              <div style="background:${C.surface};border:1px solid ${C.border};padding:14px 16px">
                <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.textMuted};text-transform:uppercase;margin-bottom:8px">Por sucursal</div>
                ${porLocalRows}
              </div>
            </td>
          </tr>
        </table>
        ${tipoRows ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-top:10px">
          <tr>
            <th style="${thStyle}left">Tipo</th>
            <th style="${thStyle}right">Monto</th>
            <th style="${thStyle}right">%</th>
          </tr>
          ${tipoRows}
        </table>` : ''}
      </div>`;
  })() : '';

  // ── Top productos ─────────────────────────────────────────────────────────
  const produccionSection = (produccionData && produccionData.topProductos.length > 0) ? (() => {
    const rows = produccionData.topProductos.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td style="${tdStyle}color:${C.textMuted};font-weight:700;font-size:11px;width:30px">${i + 1}</td>
        <td style="${tdStyle}font-weight:500">${p.nombre}</td>
        <td style="${tdStyle}color:${C.textSub}">${p.categoria}</td>
        <td style="${tdStyle}text-align:right;font-weight:700">${p.unidades.toLocaleString('es-CL')}</td>
        <td style="${tdStyle}text-align:right;font-weight:600;color:${C.green}">${fmt(p.ingresos)}</td>
      </tr>`).join('');
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-top:24px">
        ${sectionHeader('Top productos del período', C.green)}
        <tr>
          <th style="${thStyle}left;width:30px">#</th>
          <th style="${thStyle}left">Producto</th>
          <th style="${thStyle}left">Categoría</th>
          <th style="${thStyle}right">Unidades</th>
          <th style="${thStyle}right">Ingresos</th>
        </tr>
        ${rows}
        <tr>
          <td colspan="5" style="padding:8px 14px;font-size:11px;color:${C.textSub};border-bottom:1px solid ${C.border}">
            Total pedidos del período: <strong style="color:${C.text}">${produccionData.totalPedidos.toLocaleString('es-CL')}</strong>
          </td>
        </tr>
      </table>`;
  })() : '';

  // ── Gasto fijo ────────────────────────────────────────────────────────────
  const gastoFijoSection = (gastoFijoData && gastoFijoData.totalGeneral > 0) ? (() => {
    const gfMap = Object.fromEntries(gastoFijoData.porLocal.map(l => [l.local, l.total]));
    const locales = Object.keys(current.porSucursal);
    let totV = 0, totGV = 0, totGF = 0;

    const rentRows = locales.map((nombre, i) => {
      const s = current.porSucursal[nombre];
      const gf = gfMap[nombre] ?? 0;
      const rent = s.ventas - s.gastos - gf;
      totV += s.ventas; totGV += s.gastos; totGF += gf;
      return `
        <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
          <td style="${tdStyle}font-weight:600">${nombre}</td>
          <td style="${tdStyle}text-align:right">${fmt(s.ventas)}</td>
          <td style="${tdStyle}text-align:right;color:${C.amber}">${fmt(s.gastos)}</td>
          <td style="${tdStyle}text-align:right;color:${C.cyan}">${fmt(gf)}</td>
          <td style="${tdStyle}text-align:right;font-weight:700;color:${rent >= 0 ? C.green : C.red}">${fmt(rent)}</td>
        </tr>`;
    }).join('');
    const totalRent = totV - totGV - totGF;

    const localCards = gastoFijoData.porLocal.map(l => `
      <td style="padding:4px;vertical-align:top">
        <div style="background:${C.cyanBg};border:1px solid ${C.cyanBdr};padding:12px 14px">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.cyan};text-transform:uppercase;margin-bottom:6px">${l.local}</div>
          <div style="font-size:18px;font-weight:800;color:${C.text};margin-bottom:8px">${fmt(l.total)}</div>
          ${l.categorias.map(c => `
            <div style="display:flex;justify-content:space-between;font-size:11px;color:${C.textSub};margin-bottom:2px">
              <span>${c.categoria}</span><span style="font-weight:600">${fmt(c.monto)}</span>
            </div>`).join('')}
        </div>
      </td>`).join('');

    return `
      <div style="margin-top:24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${sectionHeader('Gasto fijo del período', C.cyan)}
        </table>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>${localCards}</tr></table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-top:12px">
          <tr>
            <th style="${thStyle}left;font-size:9px">Rentabilidad por sucursal</th>
            <th style="${thStyle}right">Ventas</th>
            <th style="${thStyle}right">Gasto variable</th>
            <th style="${thStyle}right">Gasto fijo</th>
            <th style="${thStyle}right">Rentabilidad</th>
          </tr>
          ${rentRows}
          <tr style="background:${C.surfaceAlt};border-top:2px solid ${C.borderStrong}">
            <td style="${tdStyle}font-weight:800;font-size:13px">TOTAL</td>
            <td style="${tdStyle}text-align:right;font-weight:800">${fmt(totV)}</td>
            <td style="${tdStyle}text-align:right;font-weight:800;color:${C.amber}">${fmt(totGV)}</td>
            <td style="${tdStyle}text-align:right;font-weight:800;color:${C.cyan}">${fmt(totGF)}</td>
            <td style="${tdStyle}text-align:right;font-weight:800;color:${totalRent >= 0 ? C.green : C.red}">${fmt(totalRent)}</td>
          </tr>
        </table>
      </div>`;
  })() : '';

  // ── Insights ──────────────────────────────────────────────────────────────
  const insightsSection = (insights && insights.length > 0) ? (() => {
    const items = insights.slice(0, 8).map(ins => {
      const s = insightStyle(ins.type);
      return `
        <div style="margin-bottom:8px;padding:12px 16px;background:${s.bg};border-left:4px solid ${s.col};border-top:1px solid ${s.bdr};border-right:1px solid ${s.bdr};border-bottom:1px solid ${s.bdr};">
          <div style="font-weight:700;font-size:13px;color:${s.col};margin-bottom:4px">${ins.titulo}</div>
          <div style="font-size:12px;color:${C.textSub};line-height:1.5">${ins.descripcion}</div>
          ${ins.accion ? `<div style="font-size:12px;color:${C.textSub};margin-top:5px;font-style:italic">Acción: ${ins.accion}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div style="margin-top:24px">
        <table width="100%" cellpadding="0" cellspacing="0">${sectionHeader('Alertas e insights automáticos', C.amber)}</table>
        ${items}
      </div>`;
  })() : '';

  // ── Análisis IA ───────────────────────────────────────────────────────────
  const aiSection = aiAnalysis ? `
    <div style="margin-top:24px">
      <table width="100%" cellpadding="0" cellspacing="0">${sectionHeader('Análisis inteligente', C.purple)}</table>
      ${aiAnalysis.resumen ? `
        <div style="margin-bottom:10px;padding:16px 20px;background:${C.purpleBg};border-left:4px solid ${C.purple};border-top:1px solid ${C.purpleBdr};border-right:1px solid ${C.purpleBdr};border-bottom:1px solid ${C.purpleBdr}">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.purple};text-transform:uppercase;margin-bottom:8px">Resumen ejecutivo</div>
          <p style="font-size:13px;color:${C.text};line-height:1.65;margin:0">${aiAnalysis.resumen}</p>
        </div>` : ''}
      ${aiAnalysis.comparacion ? `
        <div style="margin-bottom:10px;padding:16px 20px;background:${C.surface};border-left:4px solid ${C.borderStrong};border-top:1px solid ${C.border};border-right:1px solid ${C.border};border-bottom:1px solid ${C.border}">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.textMuted};text-transform:uppercase;margin-bottom:8px">Análisis comparativo</div>
          <p style="font-size:13px;color:${C.text};line-height:1.65;margin:0">${aiAnalysis.comparacion}</p>
        </div>` : ''}
      ${(aiAnalysis.problemas?.length ?? 0) > 0 ? `
        <div style="margin-bottom:10px;padding:14px 18px;background:${C.redBg};border-left:4px solid ${C.red};border-top:1px solid ${C.redBdr};border-right:1px solid ${C.redBdr};border-bottom:1px solid ${C.redBdr}">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.red};text-transform:uppercase;margin-bottom:10px">Problemas detectados</div>
          ${(aiAnalysis.problemas ?? []).map(p => `<div style="font-size:13px;color:${C.text};margin-bottom:6px;padding-left:12px">• ${p}</div>`).join('')}
        </div>` : ''}
      ${(aiAnalysis.recomendaciones?.length ?? 0) > 0 ? `
        <div style="padding:14px 18px;background:${C.greenBg};border-left:4px solid ${C.green};border-top:1px solid ${C.greenBdr};border-right:1px solid ${C.greenBdr};border-bottom:1px solid ${C.greenBdr}">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.green};text-transform:uppercase;margin-bottom:10px">Recomendaciones</div>
          ${(aiAnalysis.recomendaciones ?? []).map((r, i) => `<div style="font-size:13px;color:${C.text};margin-bottom:6px;padding-left:12px">${i + 1}. ${r}</div>`).join('')}
        </div>` : ''}
    </div>` : '';

  // ── HTML final ────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Informe FinanzasOca</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<div style="max-width:700px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.10)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,${C.navy} 0%,${C.navyLight} 100%);padding:28px 32px">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:#93c5fd;text-transform:uppercase;margin-bottom:6px">FinanzasOca · Informe de gestión</div>
    <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;margin-bottom:8px">
      ${tendenciaChar} ${fd(filters.fechaDesde)} – ${fd(filters.fechaHasta)}
    </div>
    <div style="font-size:13px;color:#bfdbfe;margin-bottom:4px">${sucursalLabel}</div>
    <div style="font-size:11px;color:#93c5fd">Generado: ${generadoLabel}</div>
  </div>

  <!-- Cuerpo -->
  <div style="padding:28px 32px">

    <!-- KPIs del período -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
      ${sectionHeader('Indicadores clave del período')}
      <tr>${kpiCards}</tr>
    </table>

    <!-- Comparación de períodos -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-bottom:0">
      ${sectionHeader('Comparación de períodos')}
      <tr>
        <th style="${thStyle}left">Métrica</th>
        <th style="${thStyle}right">Período actual</th>
        <th style="${thStyle}right">${prevLabel}</th>
        <th style="${thStyle}right">Variación</th>
      </tr>
      ${compRows}
    </table>

    <!-- Por sucursal -->
    ${sucursalSection}

    <!-- Top proveedores -->
    ${proveedoresSection}

    <!-- Merma -->
    ${mermaSection}

    <!-- Top productos -->
    ${produccionSection}

    <!-- Gasto fijo -->
    ${gastoFijoSection}

    <!-- Insights -->
    ${insightsSection}

    <!-- Análisis IA -->
    ${aiSection}

  </div>

  <!-- Footer -->
  <div style="background:${C.surface};padding:16px 32px;border-top:1px solid ${C.border}">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;font-weight:700;color:${C.navy};letter-spacing:0.05em">FINANZASOCA</td>
        <td style="font-size:11px;color:${C.textMuted};text-align:center">
          ${fd(filters.fechaDesde)} al ${fd(filters.fechaHasta)}
        </td>
        <td style="font-size:11px;color:${C.textMuted};text-align:right">Confidencial</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

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
      return NextResponse.json(
        { ok: false, error: 'RESEND_API_KEY no configurado' },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);
    const { filters } = reportData;
    const tendChar = reportData.tendencia === 'up' ? '▲' : reportData.tendencia === 'down' ? '▼' : '►';
    const dateLabel = filters.fechaDesde === filters.fechaHasta
      ? `el ${filters.fechaDesde}`
      : `${filters.fechaDesde} al ${filters.fechaHasta}`;
    const sucLabel = filters.sucursal ? ` · ${filters.sucursal}` : '';
    const defaultSubject = `${tendChar} Nuevo informe financiero de La Oca — ${dateLabel}${sucLabel}`;
    const emailSubject = subject ?? defaultSubject;

    const html = buildEmailHtml(reportData);
    const from = process.env.RESEND_FROM ?? 'informes@finanzasoca.cl';

    const { data, error } = await resend.emails.send({ from, to: recipients, subject: emailSubject, html });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, messageId: data?.id ?? null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
