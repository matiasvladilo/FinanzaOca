/**
 * POST /api/informes/send-email
 * Envía el informe de gestión completo por correo (espeja el ReportDocument de la UI).
 *
 * Body: { recipients: string[], reportData: object, subject?: string }
 */

import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';

// Forzar runtime Node (no Edge) y más tiempo de ejecución.
export const runtime = 'nodejs';
export const maxDuration = 60;

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

interface DistribuidoraData {
  gastoExterno: number;
  facturas: number;
  topProveedores: Array<{ nombre: string; monto: number }>;
  traspasoALocales: number;
  porLocal: Array<{ local: string; monto: number }>;
}

interface ProyeccionSucursal {
  nombre: string;
  ventasActuales: number;
  promedioDiario: number;
  ventasProyectadasMes: number;
}

interface Proyeccion {
  diasTranscurridos: number;
  promedioDiario: number;
  diasRestantesMes: number;
  diasTotalesMes: number;
  diaDelMes: number;
  ventasProyectadasMes: number;
  duracionPeriodo: number;
  ventasProyectadasSiguiente: number;
  porSucursal: ProyeccionSucursal[];
}

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
  distribuidoraData?: DistribuidoraData | null;
  proyeccion?: Proyeccion;
}

interface SendEmailBody {
  recipients: string[];
  reportData: ReportData;
  subject?: string;
}

// ── Paleta ────────────────────────────────────────────────────────────────────
// Tono documento operativo, no dashboard: acentos desaturados y fondos casi
// blancos. Los acentos se usan sobre blanco en texto chico, así que están
// bajados hasta ~4.5:1 de contraste — pastel en el fondo, legible en el texto.

const C = {
  bg:          '#ffffff',
  surface:     '#fafbfc',
  surfaceAlt:  '#f4f6f8',
  border:      '#e5e9ed',
  borderStrong:'#d3dae1',
  navy:        '#3a4a5e',
  navyLight:   '#4a5f7a',
  blue:        '#3d6f9f',
  blueLight:   '#eef3f8',
  text:        '#2d3540',
  textSub:     '#5f6b7a',
  textMuted:   '#6e7a88',
  green:       '#4a7a5c',
  greenBg:     '#f4f8f5',
  greenBdr:    '#d5e3da',
  red:         '#a05555',
  redBg:       '#faf4f4',
  redBdr:      '#e8d6d6',
  amber:       '#96703c',
  amberBg:     '#faf7f1',
  amberBdr:    '#e7dcc7',
  purple:      '#6f6291',
  purpleBg:    '#f6f5f9',
  purpleBdr:   '#ddd8e6',
  cyan:        '#4a7684',
  cyanBg:      '#f2f6f8',
  cyanBdr:     '#d2e0e5',
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
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <tr>
          <td style="width:4px;background:${accent};font-size:16px;line-height:16px">&nbsp;</td>
          <td style="padding-left:10px;vertical-align:middle">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:${C.textSub};text-transform:uppercase">${title}</span>
          </td>
        </tr>
      </table>
      <div style="border-top:1px solid ${C.border};margin-top:8px"></div>
    </td>
  </tr>`;
}

/**
 * Barras horizontales con tablas anidadas — no hay SVG ni CSS moderno que
 * sobreviva a Outlook/Gmail, así que el ancho de la barra es un width="%" real.
 */
function barChart(rows: Array<{ label: string; value: number; color?: string }>): string {
  const max = Math.max(...rows.map(r => r.value), 1);
  return rows.map(r => {
    const pct = Math.max(Math.round((r.value / max) * 100), 1);
    const color = r.color ?? C.blue;
    return `
    <tr>
      <td width="88" class="em-text-sub" style="padding:3px 8px 3px 0;font-size:11px;color:${C.textSub};white-space:nowrap">${r.label}</td>
      <td style="padding:3px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
          <td width="${pct}%" style="background:${color};font-size:0;line-height:13px;height:13px">&nbsp;</td>
          <td width="${100 - pct}%" class="em-surface" style="background:${C.surfaceAlt};font-size:0;line-height:13px;height:13px">&nbsp;</td>
        </tr></table>
      </td>
      <td width="104" align="right" class="em-text" style="padding:3px 0 3px 8px;font-size:11px;font-weight:700;color:${C.text};white-space:nowrap">${fmt(r.value)}</td>
    </tr>`;
  }).join('');
}

/**
 * Los insights van sobre fondo neutro: el color queda solo en el filete
 * izquierdo y en la etiqueta chica. Un bloque entero teñido de rojo lee como
 * alarma, y acá la mayoría son observaciones de rutina.
 */
function insightStyle(type: Insight['type']): { col: string; label: string } {
  if (type === 'positive') return { col: C.green, label: 'Favorable' };
  if (type === 'negative') return { col: C.red,   label: 'Revisar'   };
  return                          { col: C.amber, label: 'Atención'  };
}

// ── Constructor del HTML ──────────────────────────────────────────────────────

function buildEmailHtml(d: ReportData): string {
  const { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, deltaTx,
          tendencia, insights, aiAnalysis, mermaData, produccionData, gastoFijoData,
          generatedAt, periodoAnterior, proyeccion, distribuidoraData } = d;

  const sucursalLabel = filters.sucursal ? filters.sucursal : 'Todas las sucursales';
  const generadoLabel = generatedAt
    ? new Date(generatedAt).toLocaleString('es-CL')
    : new Date().toLocaleString('es-CL');

  const tendenciaChar = tendencia === 'up' ? '▲' : tendencia === 'down' ? '▼' : '►';

  // Índice 60
  const indice50Curr = current.ventas  > 0 ? (current.gastos  / current.ventas)  * 100 : 0;
  const indice50Prev = previous.ventas > 0 ? (previous.gastos / previous.ventas) * 100 : 0;
  const deltaIndice50 = indice50Curr - indice50Prev;
  const deltaTicket   = pctDelta(current.ticketPromedio, previous.ticketPromedio);

  const thStyle = `padding:9px 14px;font-size:10px;font-weight:700;color:${C.textSub};background:${C.surface};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${C.borderStrong};text-align:`;
  const thClass = `em-th`;
  const tdStyle = `padding:10px 14px;font-size:13px;border-bottom:1px solid ${C.border};color:${C.text};`;

  // ── KPIs del período ──────────────────────────────────────────────────────
  const kpiDefs = [
    { label: 'Ventas brutas',  value: fmt(current.ventas),           delta: deltaVentas,       invertGood: false, accent: C.blue   },
    { label: 'Gastos totales', value: fmt(current.gastos),           delta: deltaGastos,       invertGood: true,  accent: C.amber  },
    { label: 'Margen neto',    value: fmt(current.margen),           delta: deltaMargen,       invertGood: false, accent: C.green  },
    { label: 'Índice 60',      value: `${indice50Curr.toFixed(1)}%`, delta: -deltaIndice50,    invertGood: false, accent: indice50Curr <= 60 ? C.green : C.red },
  ];
  const kpiCell = (k: typeof kpiDefs[0]) => `
    <td width="50%" style="padding:4px;vertical-align:top">
      <table width="100%" cellpadding="0" cellspacing="0" class="em-kpi" style="border-collapse:collapse;background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${k.accent}">
        <tr><td style="padding:14px 12px">
          <div class="em-text-muted" style="font-size:9px;font-weight:700;letter-spacing:0.1em;color:${C.textMuted};text-transform:uppercase;margin-bottom:8px">${k.label}</div>
          <div class="em-text" style="font-size:18px;font-weight:800;color:${C.text};margin-bottom:6px;line-height:1">${k.value}</div>
          <div>${deltaBadge(k.delta, k.invertGood)}</div>
        </td></tr>
      </table>
    </td>`;
  const kpiCards = `
    <tr>${kpiCell(kpiDefs[0])}${kpiCell(kpiDefs[1])}</tr>
    <tr>${kpiCell(kpiDefs[2])}${kpiCell(kpiDefs[3])}</tr>`;

  // ── Comparación de períodos ───────────────────────────────────────────────
  const prevLabel = periodoAnterior
    ? `${fd(periodoAnterior.fechaDesde)} – ${fd(periodoAnterior.fechaHasta)}`
    : 'Período anterior';

  const compRows = [
    { label: 'Ventas',           curr: fmt(current.ventas),                  prev: fmt(previous.ventas),           delta: deltaVentas,    inv: false },
    { label: 'Gastos',           curr: fmt(current.gastos),                  prev: fmt(previous.gastos),           delta: deltaGastos,    inv: true  },
    { label: 'Margen',           curr: `${fmt(current.margen)} (${current.margenPct.toFixed(1)}%)`,
                                  prev: `${fmt(previous.margen)} (${previous.margenPct.toFixed(1)}%)`, delta: deltaMargen, inv: false },
    { label: 'Índice 60',        curr: `${indice50Curr.toFixed(1)}%`,         prev: `${indice50Prev.toFixed(1)}%`,  delta: -deltaIndice50, inv: false },
    { label: 'Transacciones',    curr: current.transacciones.toLocaleString('es-CL'),
                                  prev: previous.transacciones.toLocaleString('es-CL'), delta: deltaTx, inv: false },
    { label: 'Ticket promedio',  curr: fmt(current.ticketPromedio),           prev: fmt(previous.ticketPromedio),   delta: deltaTicket,    inv: false },
  ].map((r, i) => `
    <tr class="${i % 2 === 0 ? 'em-td-base' : 'em-td-alt'}" style="background:${i % 2 === 0 ? C.bg : C.surface}">
      <td class="em-text" style="${tdStyle}font-weight:600">${r.label}</td>
      <td class="em-text" style="${tdStyle}text-align:right;font-weight:700">${r.curr}</td>
      <td class="em-text-sub" style="${tdStyle}text-align:right;color:${C.textSub}">${r.prev}</td>
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
        const indice50Color = indice50Suc <= 60 ? C.green : C.red;
        return `
          <tr class="${i % 2 === 0 ? 'em-td-base' : 'em-td-alt'}" style="background:${i % 2 === 0 ? C.bg : C.surface}">
            <td class="em-text" style="${tdStyle}font-weight:600">${nombre}</td>
            <td class="em-text" style="${tdStyle}text-align:right;font-weight:700">${fmt(data.ventas)}</td>
            <td style="${tdStyle}text-align:right;color:${C.amber}">${fmt(data.gastos)}</td>
            <td style="${tdStyle}text-align:right;color:${data.margen >= 0 ? C.green : C.red};font-weight:600">${fmt(data.margen)}</td>
            <td class="em-text-sub" style="${tdStyle}text-align:right;font-size:11px;color:${C.textSub}">${margenPct.toFixed(1)}%</td>
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
          <th style="${thStyle}right">Índice 60</th>
          <th style="${thStyle}right">Δ Ventas</th>
        </tr>
        ${rows}
      </table>`;
  })() : '';

  // ── Top proveedores ───────────────────────────────────────────────────────
  const proveedoresSection = current.topProveedores.length > 0 ? (() => {
    const rows = current.topProveedores.map((p, i) => `
      <tr class="${i % 2 === 0 ? 'em-td-base' : 'em-td-alt'}" style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td class="em-text-muted" style="${tdStyle}color:${C.textMuted};font-weight:700;font-size:11px;width:30px">${i + 1}</td>
        <td class="em-text" style="${tdStyle}font-weight:500">${p.nombre || 'Sin nombre'}</td>
        <td class="em-text" style="${tdStyle}text-align:right;font-weight:700">${fmt(p.monto)}</td>
        <td class="em-text-sub" style="${tdStyle}text-align:right;font-size:11px;color:${C.textSub}">${p.pct.toFixed(1)}%</td>
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
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px">
        <tr>
          <td style="font-size:12px;color:${C.textSub}">${l.local}</td>
          <td style="font-size:12px;font-weight:700;text-align:right">${fmt(l.monto)} <span style="color:${C.textMuted};font-weight:400">(${l.pct}%)</span></td>
        </tr>
      </table>`).join('');

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
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:2px">
              <tr>
                <td style="font-size:11px;color:${C.textSub}">${c.categoria}</td>
                <td style="font-size:11px;color:${C.textSub};font-weight:600;text-align:right">${fmt(c.monto)}</td>
              </tr>
            </table>`).join('')}
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

  // ── Ficha numérica del período (cifras planas, sin adornos) ───────────────
  const fichaRows: Array<[string, string]> = [
    ['Ventas totales',      fmt(current.ventas)],
    ['Gastos totales',      fmt(current.gastos)],
    ['Margen',              `${fmt(current.margen)}  (${current.margenPct.toFixed(1)}%)`],
    ['Índice 60',           `${indice50Curr.toFixed(1)}%`],
    ['Transacciones',       `${current.transacciones.toLocaleString('es-CL')} cierres de caja`],
    ['Ticket promedio',     fmt(current.ticketPromedio)],
    ['Días del período',    `${current.porDia.length}`],
  ];
  const fichaSection = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-bottom:24px">
      ${sectionHeader('Cifras del período', C.navy)}
      ${fichaRows.map(([k, v], i) => `
      <tr class="${i % 2 === 0 ? 'em-td-base' : 'em-td-alt'}" style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td class="em-text-sub" style="${tdStyle}color:${C.textSub};font-size:12px">${k}</td>
        <td class="em-text" style="${tdStyle}text-align:right;font-weight:700;font-variant-numeric:tabular-nums">${v}</td>
      </tr>`).join('')}
    </table>`;

  // ── Gráfico de ventas por sucursal ────────────────────────────────────────
  const chartSection = Object.keys(current.porSucursal).length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px">
      ${sectionHeader('Ventas por sucursal', C.blue)}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
      ${barChart(
        Object.entries(current.porSucursal)
          .sort(([, a], [, b]) => b.ventas - a.ventas)
          .map(([nombre, dd]) => ({ label: nombre, value: dd.ventas })),
      )}
    </table>` : '';

  // ── Distribuidora (informativo, no suma a los totales) ────────────────────
  const distribuidoraSection = (distribuidoraData &&
    (distribuidoraData.gastoExterno > 0 || distribuidoraData.traspasoALocales > 0)) ? (() => {
    const dd = distribuidoraData;
    const enStock = dd.gastoExterno - dd.traspasoALocales;
    const provRows = dd.topProveedores.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td class="em-text" style="${tdStyle}font-size:12px">${p.nombre}</td>
        <td class="em-text" style="${tdStyle}text-align:right;font-weight:700;font-size:12px">${fmt(p.monto)}</td>
      </tr>`).join('');
    const localRows = dd.porLocal.map((l, i) => `
      <tr style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td class="em-text" style="${tdStyle}font-size:12px">${l.local}</td>
        <td class="em-text" style="${tdStyle}text-align:right;font-weight:700;font-size:12px">${fmt(l.monto)}</td>
      </tr>`).join('');
    return `
      <div style="margin-top:24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
          ${sectionHeader('Distribuidora — dato informativo', C.cyan)}
        </table>
        <div class="em-cyan-bg" style="background:${C.cyanBg};border:1px solid ${C.cyanBdr};padding:10px 14px;margin-bottom:10px">
          <span style="font-size:11px;color:${C.textSub};line-height:1.5">
            Distribuidora traspasa <strong>al costo</strong>: lo que un local le compra ya está contado
            como gasto de ese local. Estas cifras <strong>no se suman</strong> a los totales de arriba.
          </span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="33%" style="padding:0 4px 0 0;vertical-align:top">
              <div class="em-surface" style="background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${C.cyan};padding:12px">
                <div class="em-text-muted" style="font-size:9px;font-weight:700;letter-spacing:0.08em;color:${C.textMuted};text-transform:uppercase;margin-bottom:6px">Compró a terceros</div>
                <div class="em-text" style="font-size:16px;font-weight:800;color:${C.text}">${fmt(dd.gastoExterno)}</div>
                <div class="em-text-sub" style="font-size:10px;color:${C.textSub};margin-top:3px">${dd.facturas} factura${dd.facturas === 1 ? '' : 's'}</div>
              </div>
            </td>
            <td width="33%" style="padding:0 4px;vertical-align:top">
              <div class="em-surface" style="background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${C.green};padding:12px">
                <div class="em-text-muted" style="font-size:9px;font-weight:700;letter-spacing:0.08em;color:${C.textMuted};text-transform:uppercase;margin-bottom:6px">Traspasó a locales</div>
                <div class="em-text" style="font-size:16px;font-weight:800;color:${C.text}">${fmt(dd.traspasoALocales)}</div>
                <div class="em-text-sub" style="font-size:10px;color:${C.textSub};margin-top:3px">ya contado en cada local</div>
              </div>
            </td>
            <td width="33%" style="padding:0 0 0 4px;vertical-align:top">
              <div class="em-surface" style="background:${C.surface};border:1px solid ${C.border};border-top:3px solid ${enStock >= 0 ? C.amber : C.textMuted};padding:12px">
                <div class="em-text-muted" style="font-size:9px;font-weight:700;letter-spacing:0.08em;color:${C.textMuted};text-transform:uppercase;margin-bottom:6px">Diferencia</div>
                <div class="em-text" style="font-size:16px;font-weight:800;color:${C.text}">${fmt(enStock)}</div>
                <div class="em-text-sub" style="font-size:10px;color:${C.textSub};margin-top:3px">${enStock >= 0 ? 'comprado, aún no traspasado' : 'traspasado por sobre lo comprado'}</div>
              </div>
            </td>
          </tr>
        </table>
        ${(provRows || localRows) ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
          <tr>
            ${provRows ? `
            <td width="50%" style="padding-right:5px;vertical-align:top">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border}">
                <tr><th colspan="2" style="${thStyle}left">Le compró a</th></tr>
                ${provRows}
              </table>
            </td>` : ''}
            ${localRows ? `
            <td width="50%" style="padding-left:${provRows ? '5px' : '0'};vertical-align:top">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border}">
                <tr><th colspan="2" style="${thStyle}left">Le vendió a</th></tr>
                ${localRows}
              </table>
            </td>` : ''}
          </tr>
        </table>` : ''}
      </div>`;
  })() : '';

  // ── Insights ──────────────────────────────────────────────────────────────
  const insightsSection = (insights && insights.length > 0) ? (() => {
    const items = insights.slice(0, 8).map(ins => {
      const s = insightStyle(ins.type);
      return `
        <tr>
          <td style="padding:0 0 6px">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
              <tr>
                <td width="3" style="background:${s.col};font-size:0;line-height:0">&nbsp;</td>
                <td style="background:${C.surface};border-top:1px solid ${C.border};border-right:1px solid ${C.border};border-bottom:1px solid ${C.border};padding:9px 14px">
                  <span style="font-size:9px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${s.col}">${s.label}</span>
                  <span style="color:${C.borderStrong};padding:0 5px">·</span>
                  <span style="font-size:12.5px;font-weight:600;color:${C.text}">${ins.titulo}</span>
                  <div style="font-size:12px;color:${C.textSub};line-height:1.5;margin-top:3px">${ins.descripcion}</div>
                  ${ins.accion ? `<div style="font-size:11.5px;color:${C.textMuted};margin-top:4px">Acción: ${ins.accion}</div>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-top:24px">
        <table width="100%" cellpadding="0" cellspacing="0">${sectionHeader('Observaciones del período', C.navy)}</table>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${items}</table>
      </div>`;
  })() : '';

  // ── Análisis IA — cuatro áreas con el mismo tratamiento visual ────────────
  // Filete de 3px y etiqueta chica en color; el cuerpo siempre sobre fondo
  // casi blanco. Cuatro bloques teñidos enteros competían entre sí.
  const aiBlock = (label: string, color: string, bg: string, body: string) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px">
      <tr>
        <td width="3" style="background:${color};font-size:0;line-height:0">&nbsp;</td>
        <td style="background:${bg};border-top:1px solid ${C.border};border-right:1px solid ${C.border};border-bottom:1px solid ${C.border};padding:12px 16px">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.09em;color:${color};text-transform:uppercase;margin-bottom:7px">${label}</div>
          ${body}
        </td>
      </tr>
    </table>`;

  const aiParagraph = (t: string) =>
    `<p style="font-size:12.5px;color:${C.text};line-height:1.6;margin:0">${t}</p>`;

  const aiList = (items: string[], numbered: boolean) =>
    items.map((t, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:5px"><tr>
        <td width="16" valign="top" style="font-size:12px;color:${C.textMuted};line-height:1.6">${numbered ? `${i + 1}.` : '·'}</td>
        <td style="font-size:12.5px;color:${C.text};line-height:1.6">${t}</td>
      </tr></table>`).join('');

  const aiSection = aiAnalysis ? `
    <div style="margin-top:24px">
      <table width="100%" cellpadding="0" cellspacing="0">${sectionHeader('Análisis del período', C.navy)}</table>
      ${aiAnalysis.resumen      ? aiBlock('Resumen ejecutivo',   C.blue,   C.blueLight, aiParagraph(aiAnalysis.resumen))       : ''}
      ${aiAnalysis.comparacion  ? aiBlock('Análisis comparativo', C.purple, C.purpleBg,  aiParagraph(aiAnalysis.comparacion))   : ''}
      ${(aiAnalysis.problemas?.length ?? 0) > 0
        ? aiBlock('Puntos a revisar', C.amber, C.amberBg, aiList(aiAnalysis.problemas ?? [], false)) : ''}
      ${(aiAnalysis.recomendaciones?.length ?? 0) > 0
        ? aiBlock('Recomendaciones', C.green, C.greenBg, aiList(aiAnalysis.recomendaciones ?? [], true)) : ''}
    </div>` : '';

  // ── HTML final ────────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Informe FinanzasOca</title>
  <style>
    /* Informe siempre en tono claro. Declararlo light-only evita que Apple Mail
       y Outlook inviertan la paleta; Gmail igual puede forzar su dark mode, pero
       sin reglas nuestras que lo acompañen el resultado queda mucho más cerca
       del original que con un tema oscuro propio. */
    :root { color-scheme: light only; supported-color-schemes: light; }
    body  { color-scheme: light only; }
  </style>
</head>
<body class="em-body" style="margin:0;padding:0;background:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7">
<tr><td align="center" style="padding:16px 8px">
  <table class="em-wrap" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;background:#ffffff">

  <!-- Header -->
  <tr>
    <td style="background-color:${C.navy};padding:22px 20px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;color:#c2ccd8;text-transform:uppercase;margin-bottom:6px">FinanzasOca · Informe de gestión</div>
      <div style="font-size:21px;font-weight:700;color:#ffffff;margin-bottom:8px">
        ${tendenciaChar} ${fd(filters.fechaDesde)} – ${fd(filters.fechaHasta)}
      </div>
      <div style="font-size:13px;color:#dde3ea;margin-bottom:4px">${sucursalLabel}</div>
      <div style="font-size:11px;color:#aeb9c7">Generado: ${generadoLabel}</div>
    </td>
  </tr>

  <!-- Cuerpo -->
  <tr><td class="em-wrap" style="padding:20px 16px;background:#ffffff">

    <!-- KPIs del período -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px">
      ${sectionHeader('Indicadores clave del período')}
      ${kpiCards}
    </table>

    <!-- Cifras planas del período -->
    ${fichaSection}

    <!-- Gráfico de ventas por sucursal -->
    ${chartSection}

    <!-- Proyección de ventas -->
    ${proyeccion ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.border};margin-bottom:24px">
      ${sectionHeader(`Proyección de ventas — día ${proyeccion.diaDelMes} de ${proyeccion.diasTotalesMes} (${proyeccion.diasRestantesMes} días restantes)`, C.blue)}
      <tr>
        <th style="${thStyle}left">Sucursal</th>
        <th style="${thStyle}right">Ventas actuales</th>
        <th style="${thStyle}right">Prom. diario</th>
        <th style="${thStyle}right;color:${C.blue}">Proyección cierre</th>
      </tr>
      ${proyeccion.porSucursal.map((s, i) => `
      <tr class="${i % 2 === 0 ? 'em-td-base' : 'em-td-alt'}" style="background:${i % 2 === 0 ? C.bg : C.surface}">
        <td class="em-text" style="${tdStyle}font-weight:600">${s.nombre}</td>
        <td class="em-text" style="${tdStyle}text-align:right">${fmt(s.ventasActuales)}</td>
        <td class="em-text-sub" style="${tdStyle}text-align:right;color:${C.textSub}">${fmt(s.promedioDiario)}</td>
        <td style="${tdStyle}text-align:right;font-weight:700;color:${C.blue}">${fmt(s.ventasProyectadasMes)}</td>
      </tr>`).join('')}
      <tr style="background:${C.blueLight};border-top:2px solid #93c5fd">
        <td style="${tdStyle}font-weight:800">TOTAL</td>
        <td style="${tdStyle}text-align:right;font-weight:800">${fmt(current.ventas)}</td>
        <td style="${tdStyle}text-align:right;font-weight:700;color:${C.textSub}">${fmt(proyeccion.promedioDiario)}</td>
        <td style="${tdStyle}text-align:right;font-weight:800;font-size:15px;color:${C.blue}">${fmt(proyeccion.ventasProyectadasMes)}</td>
      </tr>
    </table>` : ''}

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

    <!-- Distribuidora (informativo) -->
    ${distribuidoraSection}

    <!-- Insights -->
    ${insightsSection}

    <!-- Análisis IA -->
    ${aiSection}

  </td></tr>

  <!-- Footer -->
  <tr>
    <td class="em-surface em-border" style="background:${C.surface};padding:16px 20px;border-top:1px solid ${C.border}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:11px;font-weight:700;color:${C.navy};letter-spacing:0.05em">FINANZASOCA</td>
          <td style="font-size:11px;color:${C.textMuted};text-align:center">
            ${fd(filters.fechaDesde)} al ${fd(filters.fechaHasta)}
          </td>
          <td style="font-size:11px;color:${C.textMuted};text-align:right">Confidencial</td>
        </tr>
      </table>
    </td>
  </tr>

  </table>
</td></tr></table>
</body>
</html>`;
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
    const from = process.env.RESEND_FROM ?? 'informes@finanzasoca.com';

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
