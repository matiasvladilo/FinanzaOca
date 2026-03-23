'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

function getSessionPermissions() {
  if (typeof document === 'undefined') return { canAccessGastoFijo: true };
  const match = document.cookie.split(';').find(c => c.trim().startsWith('session='));
  if (!match) return { canAccessGastoFijo: false };
  try {
    const s = JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
    const roleMap: Record<string, boolean> = { admin: true, usuario: false };
    return { canAccessGastoFijo: roleMap[s.role] ?? false };
  } catch { return { canAccessGastoFijo: false }; }
}
import {
  FileText, Download, Mail, RefreshCw, Brain,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info,
  ChevronDown, ChevronUp, Calendar, Building2, Settings,
} from 'lucide-react';
import { toLocalISODate } from '@/lib/date-utils';

// ── Tipos ──────────────────────────────────────────────────────────────────────

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
  id: string;
  type: 'positive' | 'negative' | 'warning';
  severity: 'high' | 'medium' | 'low';
  titulo: string;
  descripcion: string;
  valor?: number;
  delta?: number;
  accion?: string;
}

interface AIAnalysis {
  resumen: string;
  comparacion: string;
  problemas: string[];
  recomendaciones: string[];
  generatedAt: string;
}

interface MermaReportData {
  totalMerma: number;
  porTipo: Array<{ tipo: string; monto: number; pct: number }>;
  porLocal: Array<{ local: string; monto: number; pct: number }>;
}

interface ProduccionReportData {
  topProductos: Array<{ nombre: string; categoria: string; unidades: number; ingresos: number }>;
  totalPedidos: number;
}

interface GastoFijoCategoria {
  categoria: string;
  monto: number;
}

interface GastoFijoLocal {
  local: string;
  total: number;
  categorias: GastoFijoCategoria[];
}

interface GastoFijoData {
  porLocal: GastoFijoLocal[];
  totalGeneral: number;
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
  filters: { fechaDesde: string; fechaHasta: string; sucursal: string; tipo: string };
  generatedAt: string;
  periodoAnterior: { fechaDesde: string; fechaHasta: string };
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaVentas: number;
  deltaGastos: number;
  deltaMargen: number;
  deltaTx: number;
  tendencia: 'up' | 'down' | 'flat';
  insights: Insight[];
  mermaData?: MermaReportData;
  produccionData?: ProduccionReportData;
  gastoFijoData?: GastoFijoData;
  aiAnalysis?: AIAnalysis | null;
  proyeccion?: Proyeccion | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

function defaultDates() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    desde: toLocalISODate(firstDay),
    hasta: toLocalISODate(today),
  };
}

// ── Subcomponentes ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta, suffix = '%' }: { delta: number; suffix?: string }) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isPositive ? '#dcfce7' : isNegative ? '#fee2e2' : '#f3f4f6',
        color: isPositive ? '#166534' : isNegative ? '#991b1b' : '#6b7280',
      }}
    >
      {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}{suffix}
    </span>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const colors = {
    positive: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a' },
    negative:  { bg: '#fef2f2', border: '#fca5a5', icon: '#dc2626' },
    warning:   { bg: '#fffbeb', border: '#fcd34d', icon: '#d97706' },
  }[insight.type];

  const Icon = insight.type === 'positive' ? CheckCircle : insight.type === 'negative' ? AlertTriangle : Info;

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: colors.bg, borderColor: colors.border }}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: colors.icon }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{insight.titulo}</span>
            {insight.delta !== undefined && <DeltaBadge delta={insight.delta} />}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{insight.descripcion}</p>
          {insight.accion && (
            <p className="text-xs mt-1.5 font-medium" style={{ color: colors.icon }}>
              → {insight.accion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({
  label, value, delta, isMonetary = true, prefix = '', suffix = '', invertDelta = false,
}: {
  label: string; value: number; delta: number; isMonetary?: boolean; prefix?: string; suffix?: string; invertDelta?: boolean;
}) {
  // invertDelta: para métricas donde bajar es bueno (ej. Índice 50)
  const displayDelta = invertDelta ? -delta : delta;
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        {prefix}{isMonetary ? fmt(value) : value.toFixed(1)}{suffix}
      </span>
      <DeltaBadge delta={displayDelta} suffix="pp" />
    </div>
  );
}

// ── Mini bar chart ──────────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: Array<{ fecha: string; ventas: number; gastos: number }> }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.ventas, d.gastos]));
  const last = data.slice(-30);

  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {last.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
          <div
            className="w-full rounded-t-sm"
            style={{ height: `${maxVal > 0 ? (d.ventas / maxVal) * 100 : 0}%`, background: '#3b82f6', opacity: 0.8 }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Email Config Modal ──────────────────────────────────────────────────────────

function EmailModal({
  reportData,
  onClose,
}: {
  reportData: ReportData;
  onClose: () => void;
}) {
  const [recipients, setRecipients] = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Auto-cargar el email del usuario desde Supabase al abrir el modal
  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        console.log('[EmailModal] profile response:', data);
        if (data.ok && data.email) {
          setRecipients(data.email);
          setSavedEmail(data.email);
        }
      })
      .catch(err => console.error('[EmailModal] error:', err))
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleSend = async () => {
    const emails = recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (!emails.length) { setError('Ingresa al menos un correo'); return; }
    setSending(true);
    setError('');
    try {
      // Guardar el primer email como correo del usuario si cambió
      const primaryEmail = emails[0];
      if (primaryEmail !== savedEmail) {
        await fetch('/api/user/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: primaryEmail }),
        });
        setSavedEmail(primaryEmail);
      }

      // Quitar porDia (puede ser muy grande) antes de enviar
      const { current, previous, ...rest } = reportData;
      const slimData = {
        ...rest,
        current:  { ...current,  porDia: [] },
        previous: { ...previous, porDia: [] },
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch('/api/informes/send-email', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: emails, reportData: slimData }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.ok) { setSent(true); }
        else { setError(data.error ?? 'Error al enviar'); }
      } catch (err: unknown) {
        clearTimeout(timeout);
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Tiempo de espera agotado. Intenta de nuevo.');
        } else {
          throw err;
        }
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text)' }}>Enviar informe por correo</h3>
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium" style={{ color: 'var(--text)' }}>Informe enviado exitosamente</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Cerrar</button>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>
              Destinatarios (separados por coma)
            </label>
            <input
              type="text"
              value={recipients}
              onChange={e => setRecipients(e.target.value)}
              placeholder="email@ejemplo.com"
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none mb-1"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
            />
            {recipients !== savedEmail && recipients && (
              <p className="text-xs mb-3" style={{ color: 'var(--text-2)' }}>
                Enviando a un correo diferente al tuyo
              </p>
            )}
            <div className="mb-4" />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Automation Panel ───────────────────────────────────────────────────────────

function AutomationPanel() {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState({
    daily: false,
    weekly: false,
    monthly: true,
    recipients: '',
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('reportAutomationConfig', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Automatización de informes</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-3)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-3)' }} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs mt-4 mb-4" style={{ color: 'var(--text-2)' }}>
            Configura los informes automáticos. El servidor ejecuta el envío vía cron job configurado en Netlify.
          </p>

          <div className="space-y-3 mb-4">
            {[
              { key: 'daily', label: 'Informe diario', desc: 'Cada día con datos del día anterior' },
              { key: 'weekly', label: 'Informe semanal', desc: 'Lunes con datos de la semana anterior' },
              { key: 'monthly', label: 'Informe mensual', desc: 'Primer día del mes con datos del mes anterior' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config[key as keyof typeof config] as boolean}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-2)' }}>
            Destinatarios automáticos
          </label>
          <input
            type="text"
            value={config.recipients}
            onChange={e => setConfig(c => ({ ...c, recipients: e.target.value }))}
            placeholder="email1@ejemplo.com, email2@ejemplo.com"
            className="w-full rounded-lg px-3 py-2 text-sm border outline-none mb-4"
            style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
          />

          <div className="rounded-lg p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-2)' }}>Endpoint del cron job:</p>
            <code className="text-xs" style={{ color: 'var(--text-3)' }}>GET /api/informes/cron?type=daily|weekly|monthly&secret=CRON_SECRET</code>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 text-white"
          >
            {saved ? '✓ Configuración guardada' : 'Guardar configuración'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Paleta profesional fija ────────────────────────────────────────────────────
const R = {
  bg:        '#ffffff',
  surface:   '#f8fafc',
  surfaceAlt:'#f1f5f9',
  border:    '#e2e8f0',
  borderStrong: '#cbd5e1',
  navy:      '#0f2147',
  navyLight: '#1e3a6e',
  blue:      '#1d4ed8',
  blueLight: '#dbeafe',
  text:      '#0f172a',
  textSub:   '#475569',
  textMuted: '#94a3b8',
  green:     '#059669',
  greenBg:   '#ecfdf5',
  greenBdr:  '#6ee7b7',
  red:       '#dc2626',
  redBg:     '#fff1f2',
  redBdr:    '#fecdd3',
  amber:     '#d97706',
  amberBg:   '#fffbeb',
  amberBdr:  '#fde68a',
  purple:    '#6d28d9',
  purpleBg:  '#f5f3ff',
  purpleBdr: '#c4b5fd',
  gold:      '#b45309',
} as const;

// Cabecera de sección
function SectionHeader({ title, accent = R.blue }: { title: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: accent }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: R.textSub, textTransform: 'uppercase' as const }}>{title}</span>
    </div>
  );
}

// Badge de variación
function VarBadge({ delta, isPp = false }: { delta: number; isPp?: boolean }) {
  const pos = delta > 0; const neg = delta < 0;
  const color = pos ? R.green : neg ? R.red : R.textMuted;
  const bg    = pos ? R.greenBg : neg ? R.redBg : R.surfaceAlt;
  const sign  = delta >= 0 ? '+' : '';
  const suffix = isPp ? 'pp' : '%';
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color, background: bg, padding: '3px 8px', letterSpacing: '0.01em' }}>
      {sign}{delta.toFixed(1)}{suffix}
    </span>
  );
}

function pctChange(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function ReportDocument({ data, canAccessGastoFijo = true }: { data: ReportData; canAccessGastoFijo?: boolean }) {
  const { current, previous, deltaVentas, deltaGastos, deltaMargen, insights, aiAnalysis, mermaData, produccionData, gastoFijoData, proyeccion } = data;
  const indice50Curr  = current.ventas  > 0 ? (current.gastos  / current.ventas)  * 100 : 0;
  const indice50Prev  = previous.ventas > 0 ? (previous.gastos / previous.ventas) * 100 : 0;
  const deltaIndice50 = indice50Curr - indice50Prev;
  const deltaTicket   = pctChange(current.ticketPromedio, previous.ticketPromedio);

  const fd = (iso: string) => { const p = iso.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso; };

  // Estilos de tabla reutilizables
  // borderBottom en td: con border-collapse:collapse + border en <table>, el último td no duplica borde.
  const tdBase: React.CSSProperties = { padding: '11px 16px', fontSize: 13, borderBottom: `1px solid ${R.border}`, color: R.text };
  // th: separador más fuerte (2px) entre header y body
  const thBase: React.CSSProperties = { padding: '10px 16px', fontSize: 10, fontWeight: 700, color: R.textSub, background: R.surface, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `2px solid ${R.borderStrong}` };
  // wrapper para tablas: border externo limpio sin interferir con celdas
  const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', border: `1px solid ${R.border}` };

  // Colores para cada KPI
  const kpis = [
    { label: 'Ventas brutas',  value: fmt(current.ventas),           delta: deltaVentas,            accentColor: R.blue    },
    { label: 'Gastos totales', value: fmt(current.gastos),           delta: deltaGastos,            accentColor: R.amber   },
    { label: 'Margen neto',    value: fmt(current.margen),           delta: deltaMargen,            accentColor: R.green   },
    { label: 'Índice 50',      value: `${indice50Curr.toFixed(1)}%`, delta: -(deltaIndice50),       accentColor: indice50Curr <= 50 ? R.green : R.red },
  ];

  return (
    <div
      id="report-document"
      style={{ background: R.bg, border: `1px solid ${R.borderStrong}`, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      {/* ── Header ── */}
      <div style={{ background: R.navy, padding: '0' }}>
        {/* Franja de color superior — 4px entero para nitidez */}
        <div style={{ height: 4, background: `linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #059669 100%)` }} />
        <div style={{ padding: '28px 40px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#7dd3fc', textTransform: 'uppercase', marginBottom: 8 }}>FinanzasOca</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Informe de Gestión</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>Reporte ejecutivo de gestión financiera</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
              {fd(data.filters.fechaDesde)} — {fd(data.filters.fechaHasta)}
            </div>
            {data.filters.sucursal && (
              <div style={{ marginTop: 6, display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#0f2147', background: '#7dd3fc', padding: '2px 10px' }}>
                {data.filters.sucursal}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
              Generado el {new Date(data.generatedAt).toLocaleString('es-CL')}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column', gap: 36, background: R.bg }}>

        {/* ── KPIs ── */}
        <section>
          <SectionHeader title="Indicadores clave del período" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {kpis.map((k) => {
              const d = k.delta;
              const pos = d > 0; const neg = d < 0;
              const varColor = pos ? R.green : neg ? R.red : R.textMuted;
              const varBg    = pos ? R.greenBg : neg ? R.redBg : R.surfaceAlt;
              return (
                /* borderTop reemplaza el div interno de acento — sin overflow:hidden ni border-radius */
                <div key={k.label} style={{ background: R.bg, border: `1px solid ${R.border}`, borderTop: `3px solid ${k.accentColor}` }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: R.text, letterSpacing: '-0.02em', marginBottom: 10 }}>{k.value}</div>
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: varColor, background: varBg, padding: '3px 8px' }}>
                      {d >= 0 ? '+' : ''}{d.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Proyección de ventas ── */}
        {proyeccion && (
          <section>
            <SectionHeader title="Proyección de ventas" accent={R.blue} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {/* Proyección al cierre del mes */}
              <div style={{ background: R.blueLight, border: `1px solid #93c5fd`, borderTop: `3px solid ${R.blue}`, padding: '16px 18px', gridColumn: '1 / 2' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.blue, textTransform: 'uppercase' as const, marginBottom: 8 }}>
                  Proyección al cierre del mes
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: R.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
                  {fmt(proyeccion.ventasProyectadasMes)}
                </div>
                <div style={{ fontSize: 11, color: R.textSub }}>
                  {proyeccion.diasRestantesMes > 0
                    ? `Quedan ${proyeccion.diasRestantesMes} días del mes (día ${proyeccion.diaDelMes} de ${proyeccion.diasTotalesMes})`
                    : 'Mes completado'}
                </div>
              </div>
              {/* Siguiente período */}
              <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderTop: `3px solid ${R.purple}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.purple, textTransform: 'uppercase' as const, marginBottom: 8 }}>
                  Próximo período ({proyeccion.duracionPeriodo}d)
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: R.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
                  {fmt(proyeccion.ventasProyectadasSiguiente)}
                </div>
                <div style={{ fontSize: 11, color: R.textSub }}>Basado en promedio diario del período actual</div>
              </div>
              {/* Promedio diario */}
              <div style={{ background: R.surface, border: `1px solid ${R.border}`, borderTop: `3px solid ${R.green}`, padding: '16px 18px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.green, textTransform: 'uppercase' as const, marginBottom: 8 }}>
                  Promedio diario
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: R.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
                  {fmt(proyeccion.promedioDiario)}
                </div>
                <div style={{ fontSize: 11, color: R.textSub }}>
                  Sobre {proyeccion.diasTranscurridos} día{proyeccion.diasTranscurridos !== 1 ? 's' : ''} con ventas
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Comparación de períodos ── */}
        <section>
          <SectionHeader title="Comparación de períodos" />
          <table style={{ ...tblStyle, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left', width: '28%' }}>Métrica</th>
                <th style={{ ...thBase, textAlign: 'right' }}>
                  Período actual
                  <div style={{ fontSize: 9, fontWeight: 400, color: R.textMuted, marginTop: 1 }}>{fd(data.filters.fechaDesde)} – {fd(data.filters.fechaHasta)}</div>
                </th>
                <th style={{ ...thBase, textAlign: 'right' }}>
                  Período anterior
                  <div style={{ fontSize: 9, fontWeight: 400, color: R.textMuted, marginTop: 1 }}>{fd(data.periodoAnterior.fechaDesde)} – {fd(data.periodoAnterior.fechaHasta)}</div>
                </th>
                <th style={{ ...thBase, textAlign: 'right', width: '14%' }}>Variación</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Ventas brutas',   curr: current.ventas,         prev: previous.ventas,         delta: deltaVentas,                              fmt: fmt },
                { label: 'Gastos totales',  curr: current.gastos,         prev: previous.gastos,         delta: deltaGastos,                              fmt: fmt },
                { label: 'Margen neto',     curr: current.margen,         prev: previous.margen,         delta: deltaMargen,                              fmt: fmt },
                { label: 'Margen %',        curr: current.margenPct,      prev: previous.margenPct,      delta: current.margenPct - previous.margenPct,   fmt: (v: number) => `${v.toFixed(1)}%`, isPp: true },
                { label: 'Índice 50',       curr: indice50Curr,           prev: indice50Prev,            delta: -(deltaIndice50),                         fmt: (v: number) => `${v.toFixed(1)}%`, isPp: true },
                { label: 'Ticket promedio', curr: current.ticketPromedio, prev: previous.ticketPromedio, delta: deltaTicket,                              fmt: fmt },
              ].map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 1 ? R.surface : R.bg }}>
                  <td style={{ ...tdBase, fontWeight: 500, color: R.textSub }}>{row.label}</td>
                  <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{row.fmt(row.curr)}</td>
                  <td style={{ ...tdBase, textAlign: 'right', color: R.textSub }}>{row.fmt(row.prev)}</td>
                  <td style={{ ...tdBase, textAlign: 'right' }}>
                    <VarBadge delta={row.delta} isPp={row.isPp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── Por sucursal ── */}
        {Object.keys(current.porSucursal).length > 0 && (
          <section>
            <SectionHeader title="Distribución por sucursal" accent={R.purple} />
            <table style={{ ...tblStyle, fontSize: 13 }}>
              <thead>
                <tr>
                  {['Sucursal', 'Ventas', 'Gastos', 'Margen', 'Margen %', 'Índice 50'].map((h, i) => (
                    <th key={h} style={{ ...thBase, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(current.porSucursal).sort(([, a], [, b]) => b.ventas - a.ventas).map(([nombre, d], i) => {
                  const mPct = d.ventas > 0 ? (d.margen / d.ventas) * 100 : 0;
                  const idx  = d.ventas > 0 ? (d.gastos / d.ventas) * 100 : 0;
                  return (
                    <tr key={i} style={{ background: i % 2 === 1 ? R.surface : R.bg }}>
                      <td style={{ ...tdBase, fontWeight: 600 }}>{nombre}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmt(d.ventas)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', color: R.textSub }}>{fmt(d.gastos)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: d.margen >= 0 ? R.green : R.red }}>{fmt(d.margen)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', color: mPct >= 15 ? R.green : mPct >= 0 ? R.amber : R.red }}>{mPct.toFixed(1)}%</td>
                      <td style={{ ...tdBase, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: idx <= 50 ? R.green : R.red }}>{idx.toFixed(1)}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Top proveedores ── */}
        {current.topProveedores.length > 0 && (
          <section>
            <SectionHeader title="Top proveedores del período" accent={R.amber} />
            <table style={{ ...tblStyle, fontSize: 13 }}>
              <thead>
                <tr>
                  {['#', 'Proveedor', 'Monto', 'Participación'].map((h, i) => (
                    <th key={h} style={{ ...thBase, textAlign: i <= 1 ? 'left' : 'right', width: i === 0 ? '5%' : 'auto' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.topProveedores.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 === 1 ? R.surface : R.bg }}>
                    <td style={{ ...tdBase, color: R.textMuted, fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...tdBase, fontWeight: 500 }}>{p.nombre || 'Sin nombre'}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmt(p.monto)}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: R.blue }}>{p.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Merma ── */}
        {mermaData && mermaData.totalMerma > 0 && (
          <section>
            <SectionHeader title="Merma del período" accent={R.red} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Resumen */}
              <div style={{ background: R.redBg, border: `1px solid ${R.redBdr}`, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.red, textTransform: 'uppercase' as const, marginBottom: 8 }}>Total merma</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: R.text, marginBottom: 4 }}>{fmt(mermaData.totalMerma)}</div>
                <div style={{ fontSize: 11, color: R.textSub }}>
                  {current.ventas > 0 ? `${((mermaData.totalMerma / current.ventas) * 100).toFixed(1)}% sobre ventas` : '—'}
                </div>
              </div>
              {/* Por local */}
              <div style={{ background: R.surface, border: `1px solid ${R.border}`, padding: '14px 16px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.textMuted, textTransform: 'uppercase' as const, marginBottom: 8 }}>Por sucursal</div>
                {mermaData.porLocal.map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: R.textSub, fontWeight: 500 }}>{l.local}</span>
                    <span style={{ fontWeight: 700 }}>{fmt(l.monto)} <span style={{ color: R.textMuted, fontWeight: 400 }}>({l.pct}%)</span></span>
                  </div>
                ))}
              </div>
            </div>
            {/* Por tipo */}
            {mermaData.porTipo.length > 0 && (
              <table style={{ ...tblStyle, fontSize: 13, marginTop: 12 }}>
                <thead>
                  <tr>
                    {['Tipo de merma', 'Monto', 'Participación'].map((h, i) => (
                      <th key={h} style={{ ...thBase, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mermaData.porTipo.map((t, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? R.surface : R.bg }}>
                      <td style={{ ...tdBase, fontWeight: 500 }}>{t.tipo}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{fmt(t.monto)}</td>
                      <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: R.red }}>{t.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ── Producción / Top Productos ── */}
        {produccionData && produccionData.topProductos.length > 0 && (
          <section>
            <SectionHeader title="Top productos del período" accent={R.green} />
            <div style={{ marginBottom: 12, fontSize: 12, color: R.textSub }}>
              Total pedidos: <strong style={{ color: R.text }}>{produccionData.totalPedidos.toLocaleString('es-CL')}</strong>
            </div>
            <table style={{ ...tblStyle, fontSize: 13 }}>
              <thead>
                <tr>
                  {['#', 'Producto', 'Categoría', 'Unidades', 'Ingresos'].map((h, i) => (
                    <th key={h} style={{ ...thBase, textAlign: i <= 2 ? 'left' : 'right', width: i === 0 ? '5%' : 'auto' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produccionData.topProductos.map((p, i) => (
                  <tr key={i} style={{ background: i % 2 === 1 ? R.surface : R.bg }}>
                    <td style={{ ...tdBase, color: R.textMuted, fontWeight: 700, fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...tdBase, fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ ...tdBase, color: R.textSub }}>{p.categoria}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700 }}>{p.unidades.toLocaleString('es-CL')}</td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: R.green }}>{fmt(p.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Gasto Fijo ── */}
        {canAccessGastoFijo && gastoFijoData && gastoFijoData.totalGeneral > 0 && (
          <section>
            <SectionHeader title="Gasto fijo del período" accent="#0891b2" />
            {/* Por local */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
              {gastoFijoData.porLocal.map(l => (
                <div key={l.local} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '12px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#0891b2', textTransform: 'uppercase' as const, marginBottom: 6 }}>{l.local}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{fmt(l.total)}</div>
                  {l.categorias.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginBottom: 3 }}>
                      <span>{c.categoria}</span>
                      <span style={{ fontWeight: 600 }}>{fmt(c.monto)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {/* Tabla rentabilidad */}
            <SectionHeader title="Rentabilidad por sucursal" accent="#0f172a" />
            <table style={{ ...tblStyle, fontSize: 13 }}>
              <thead>
                <tr>
                  {['Sucursal', 'Ventas', 'Gasto Variable', 'Gasto Fijo', 'Rentabilidad'].map((h, i) => (
                    <th key={h} style={{ ...thBase, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const gfMap = Object.fromEntries(gastoFijoData.porLocal.map(l => [l.local, l.total]));
                  const locales = Object.keys(current.porSucursal);
                  let totV = 0, totGV = 0, totGF = 0;
                  const rows = locales.map((nombre, i) => {
                    const s  = current.porSucursal[nombre];
                    const gf = gfMap[nombre] ?? 0;
                    const rent = s.ventas - s.gastos - gf;
                    totV += s.ventas; totGV += s.gastos; totGF += gf;
                    const rentColor = rent >= 0 ? '#059669' : '#dc2626';
                    return (
                      <tr key={nombre} style={{ background: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
                        <td style={{ ...tdBase, fontWeight: 600 }}>{nombre}</td>
                        <td style={{ ...tdBase, textAlign: 'right' }}>{fmt(s.ventas)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', color: '#d97706' }}>{fmt(s.gastos)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', color: '#0891b2' }}>{fmt(gf)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: rentColor }}>{fmt(rent)}</td>
                      </tr>
                    );
                  });
                  const totalRent = totV - totGV - totGF;
                  const totalRentColor = totalRent >= 0 ? '#059669' : '#dc2626';
                  return (
                    <>
                      {rows}
                      <tr style={{ background: '#f1f5f9', borderTop: `2px solid #334155` }}>
                        <td style={{ ...tdBase, fontWeight: 800, fontSize: 14 }}>TOTAL</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{fmt(totV)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#d97706' }}>{fmt(totGV)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#0891b2' }}>{fmt(totGF)}</td>
                        <td style={{ ...tdBase, textAlign: 'right', fontWeight: 800, fontSize: 14, color: totalRentColor }}>{fmt(totalRent)}</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Insights ── */}
        {insights.length > 0 && (
          <section>
            <SectionHeader title="Alertas e insights automáticos" accent={R.amber} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map(ins => {
                const col = ins.type === 'positive' ? R.green : ins.type === 'negative' ? R.red : R.amber;
                const bg  = ins.type === 'positive' ? R.greenBg : ins.type === 'negative' ? R.redBg : R.amberBg;
                const bdr = ins.type === 'positive' ? R.greenBdr : ins.type === 'negative' ? R.redBdr : R.amberBdr;
                return (
                  <div key={ins.id} style={{ background: bg, borderTop: `1px solid ${bdr}`, borderRight: `1px solid ${bdr}`, borderBottom: `1px solid ${bdr}`, borderLeft: `4px solid ${col}`, padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: col, marginBottom: 4 }}>{ins.titulo}</div>
                    <div style={{ fontSize: 12, color: R.textSub, lineHeight: 1.5 }}>{ins.descripcion}</div>
                    {ins.accion && <div style={{ fontSize: 12, color: R.textSub, marginTop: 6, fontStyle: 'italic' }}>Acción: {ins.accion}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Análisis IA ── */}
        {aiAnalysis && (
          <section>
            <SectionHeader title="Análisis inteligente" accent={R.purple} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aiAnalysis.resumen && (
                <div style={{ background: R.purpleBg, borderTop: `1px solid ${R.purpleBdr}`, borderRight: `1px solid ${R.purpleBdr}`, borderBottom: `1px solid ${R.purpleBdr}`, borderLeft: `4px solid ${R.purple}`, padding: '16px 20px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.purple, textTransform: 'uppercase' as const, marginBottom: 8 }}>Resumen ejecutivo</div>
                  <p style={{ fontSize: 13, color: R.text, lineHeight: 1.65, margin: 0 }}>{aiAnalysis.resumen}</p>
                </div>
              )}
              {aiAnalysis.comparacion && (
                <div style={{ background: R.surface, borderTop: `1px solid ${R.border}`, borderRight: `1px solid ${R.border}`, borderBottom: `1px solid ${R.border}`, borderLeft: `4px solid ${R.borderStrong}`, padding: '16px 20px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.textMuted, textTransform: 'uppercase' as const, marginBottom: 8 }}>Análisis comparativo</div>
                  <p style={{ fontSize: 13, color: R.text, lineHeight: 1.65, margin: 0 }}>{aiAnalysis.comparacion}</p>
                </div>
              )}
              {(aiAnalysis.problemas?.length ?? 0) > 0 && (
                <div style={{ background: R.redBg, borderTop: `1px solid ${R.redBdr}`, borderRight: `1px solid ${R.redBdr}`, borderBottom: `1px solid ${R.redBdr}`, borderLeft: `4px solid ${R.red}`, padding: '14px 18px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.red, textTransform: 'uppercase' as const, marginBottom: 10 }}>Problemas detectados</div>
                  {aiAnalysis.problemas!.map((p, i) => <div key={i} style={{ fontSize: 13, color: R.text, marginBottom: 6, paddingLeft: 12 }}>• {p}</div>)}
                </div>
              )}
              {(aiAnalysis.recomendaciones?.length ?? 0) > 0 && (
                <div style={{ background: R.greenBg, borderTop: `1px solid ${R.greenBdr}`, borderRight: `1px solid ${R.greenBdr}`, borderBottom: `1px solid ${R.greenBdr}`, borderLeft: `4px solid ${R.green}`, padding: '14px 18px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: R.green, textTransform: 'uppercase' as const, marginBottom: 10 }}>Recomendaciones</div>
                  {aiAnalysis.recomendaciones!.map((rec, i) => <div key={i} style={{ fontSize: 13, color: R.text, marginBottom: 6, paddingLeft: 12 }}>{i + 1}. {rec}</div>)}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: R.navy, letterSpacing: '0.05em' }}>FINANZASOCA</span>
          <span style={{ fontSize: 11, color: R.textMuted }}>Informe generado el {new Date(data.generatedAt).toLocaleString('es-CL')}</span>
          <span style={{ fontSize: 11, color: R.textMuted }}>Confidencial</span>
        </div>
      </div>
    </div>
  );
}

// ── Generador de HTML para exportación ────────────────────────────────────────

function esc(s: string | number) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtHTML(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n);
}

function pctChangeHTML(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function badge(delta: number, isPp = false) {
  const pos = delta > 0; const neg = delta < 0;
  const cls = pos ? 'badge-pos' : neg ? 'badge-neg' : 'badge-neu';
  const sign = delta >= 0 ? '+' : '';
  const suffix = isPp ? 'pp' : '%';
  return `<span class="badge ${cls}">${sign}${delta.toFixed(1)}${suffix}</span>`;
}

function fdHTML(iso: string) {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function buildReportHTML(data: ReportData): string {
  const { current, previous, deltaVentas, deltaGastos, deltaMargen, insights, aiAnalysis, mermaData, produccionData, gastoFijoData, proyeccion } = data;
  const indice50Curr  = current.ventas  > 0 ? (current.gastos  / current.ventas)  * 100 : 0;
  const indice50Prev  = previous.ventas > 0 ? (previous.gastos / previous.ventas) * 100 : 0;
  const deltaIndice50 = indice50Curr - indice50Prev;
  const deltaTicket   = pctChangeHTML(current.ticketPromedio, previous.ticketPromedio);

  const kpis = [
    { label: 'Ventas brutas',  value: fmtHTML(current.ventas),           delta: deltaVentas,   accent: '#1d4ed8' },
    { label: 'Gastos totales', value: fmtHTML(current.gastos),           delta: deltaGastos,   accent: '#d97706' },
    { label: 'Margen neto',    value: fmtHTML(current.margen),           delta: deltaMargen,   accent: '#059669' },
    { label: 'Índice 50',      value: `${indice50Curr.toFixed(1)}%`,     delta: -(deltaIndice50), accent: indice50Curr <= 50 ? '#059669' : '#dc2626' },
  ];

  const kpiCards = kpis.map(k => {
    const pos = k.delta > 0; const neg = k.delta < 0;
    const varColor = pos ? '#059669' : neg ? '#dc2626' : '#94a3b8';
    const varBg    = pos ? '#ecfdf5' : neg ? '#fff1f2' : '#f1f5f9';
    return `
      <div class="kpi-card" style="border-top:3px solid ${k.accent}">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value">${esc(k.value)}</div>
        <span class="badge" style="color:${varColor};background:${varBg}">${k.delta >= 0 ? '+' : ''}${k.delta.toFixed(1)}%</span>
      </div>`;
  }).join('');

  const compRows = [
    { label: 'Ventas brutas',   curr: current.ventas,         prev: previous.ventas,         delta: deltaVentas,                           f: fmtHTML },
    { label: 'Gastos totales',  curr: current.gastos,         prev: previous.gastos,         delta: deltaGastos,                           f: fmtHTML },
    { label: 'Margen neto',     curr: current.margen,         prev: previous.margen,         delta: deltaMargen,                           f: fmtHTML },
    { label: 'Margen %',        curr: current.margenPct,      prev: previous.margenPct,      delta: current.margenPct - previous.margenPct, f: (v: number) => `${v.toFixed(1)}%`, isPp: true },
    { label: 'Índice 50',       curr: indice50Curr,           prev: indice50Prev,            delta: -(deltaIndice50),                      f: (v: number) => `${v.toFixed(1)}%`, isPp: true },
    { label: 'Ticket promedio', curr: current.ticketPromedio, prev: previous.ticketPromedio, delta: deltaTicket,                           f: fmtHTML },
  ].map((row, i) => `
    <tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
      <td style="font-weight:500;color:#475569">${esc(row.label)}</td>
      <td class="right" style="font-weight:700">${esc(row.f(row.curr))}</td>
      <td class="right" style="color:#475569">${esc(row.f(row.prev))}</td>
      <td class="right">${badge(row.delta, row.isPp)}</td>
    </tr>`).join('');

  const sucursalRows = Object.entries(current.porSucursal)
    .sort(([,a],[,b]) => b.ventas - a.ventas)
    .map(([nombre, d], i) => {
      const mPct = d.ventas > 0 ? (d.margen / d.ventas) * 100 : 0;
      const idx  = d.ventas > 0 ? (d.gastos  / d.ventas) * 100 : 0;
      return `
        <tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
          <td style="font-weight:600">${esc(nombre)}</td>
          <td class="right" style="font-weight:700">${esc(fmtHTML(d.ventas))}</td>
          <td class="right" style="color:#475569">${esc(fmtHTML(d.gastos))}</td>
          <td class="right" style="font-weight:600;color:${d.margen>=0?'#059669':'#dc2626'}">${esc(fmtHTML(d.margen))}</td>
          <td class="right" style="color:${mPct>=15?'#059669':mPct>=0?'#d97706':'#dc2626'}">${mPct.toFixed(1)}%</td>
          <td class="right" style="font-weight:700;color:${idx<=50?'#059669':'#dc2626'}">${idx.toFixed(1)}%</td>
        </tr>`;
    }).join('');

  const sucursalSection = Object.keys(current.porSucursal).length > 0 ? `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#6d28d9"></div>
        <span class="section-title">Distribución por sucursal</span>
      </div>
      <table>
        <thead><tr>
          <th>Sucursal</th><th class="right">Ventas</th><th class="right">Gastos</th>
          <th class="right">Margen</th><th class="right">Margen %</th><th class="right">Índice 50</th>
        </tr></thead>
        <tbody>${sucursalRows}</tbody>
      </table>
    </div>` : '';

  const provRows = current.topProveedores.map((p, i) => `
    <tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
      <td style="color:#94a3b8;font-weight:700;font-size:12px;width:40px">${i+1}</td>
      <td style="font-weight:500">${esc(p.nombre||'Sin nombre')}</td>
      <td class="right" style="font-weight:700">${esc(fmtHTML(p.monto))}</td>
      <td class="right" style="font-weight:600;color:#1d4ed8">${p.pct.toFixed(1)}%</td>
    </tr>`).join('');

  const provSection = current.topProveedores.length > 0 ? `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#d97706"></div>
        <span class="section-title">Top proveedores del período</span>
      </div>
      <table>
        <thead><tr>
          <th style="width:40px">#</th><th>Proveedor</th>
          <th class="right">Monto</th><th class="right">Participación</th>
        </tr></thead>
        <tbody>${provRows}</tbody>
      </table>
    </div>` : '';

  // ── Merma HTML ──
  const mermaSection = (mermaData && mermaData.totalMerma > 0) ? (() => {
    const pctSV = current.ventas > 0 ? ((mermaData.totalMerma / current.ventas) * 100).toFixed(1) : '—';
    const localRows = mermaData.porLocal.map((l, i) =>
      `<tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
        <td style="font-weight:500">${esc(l.local)}</td>
        <td class="right" style="font-weight:700">${esc(fmtHTML(l.monto))}</td>
        <td class="right" style="font-weight:600;color:#dc2626">${l.pct}%</td>
      </tr>`).join('');
    const tipoRows = mermaData.porTipo.map((t, i) =>
      `<tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
        <td style="font-weight:500">${esc(t.tipo)}</td>
        <td class="right" style="font-weight:700">${esc(fmtHTML(t.monto))}</td>
        <td class="right" style="font-weight:600;color:#dc2626">${t.pct}%</td>
      </tr>`).join('');
    return `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#dc2626"></div>
        <span class="section-title">Merma del período</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:#fff1f2;border:1px solid #fecdd3;padding:14px 16px">
          <div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#dc2626;text-transform:uppercase;margin-bottom:6px">Total merma</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:4px">${esc(fmtHTML(mermaData.totalMerma))}</div>
          <div style="font-size:11px;color:#475569">${pctSV}% sobre ventas</div>
        </div>
        <table style="margin:0">
          <thead><tr><th>Sucursal</th><th class="right">Monto</th><th class="right">%</th></tr></thead>
          <tbody>${localRows}</tbody>
        </table>
      </div>
      <table>
        <thead><tr><th>Tipo de merma</th><th class="right">Monto</th><th class="right">Participación</th></tr></thead>
        <tbody>${tipoRows}</tbody>
      </table>
    </div>`;
  })() : '';

  // ── Producción HTML ──
  const produccionSection = (produccionData && produccionData.topProductos.length > 0) ? (() => {
    const prodRows = produccionData.topProductos.map((p, i) =>
      `<tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
        <td style="color:#94a3b8;font-weight:700;font-size:12px;width:40px">${i+1}</td>
        <td style="font-weight:500">${esc(p.nombre)}</td>
        <td style="color:#475569">${esc(p.categoria)}</td>
        <td class="right" style="font-weight:700">${p.unidades.toLocaleString('es-CL')}</td>
        <td class="right" style="font-weight:600;color:#059669">${esc(fmtHTML(p.ingresos))}</td>
      </tr>`).join('');
    return `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#059669"></div>
        <span class="section-title">Top productos del período</span>
      </div>
      <div style="font-size:12px;color:#475569;margin-bottom:10px">Total pedidos: <strong style="color:#0f172a">${produccionData.totalPedidos.toLocaleString('es-CL')}</strong></div>
      <table>
        <thead><tr>
          <th style="width:40px">#</th><th>Producto</th><th>Categoría</th>
          <th class="right">Unidades</th><th class="right">Ingresos</th>
        </tr></thead>
        <tbody>${prodRows}</tbody>
      </table>
    </div>`;
  })() : '';

  // ── Gasto Fijo HTML ──
  const gastoFijoSection = (gastoFijoData && gastoFijoData.totalGeneral > 0) ? (() => {
    const localCards = gastoFijoData.porLocal.map(l => {
      const cats = l.categorias.map(c =>
        `<div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:3px">
          <span>${esc(c.categoria)}</span><span style="font-weight:600">${esc(fmtHTML(c.monto))}</span>
        </div>`).join('');
      return `
        <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px 14px">
          <div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:#0891b2;text-transform:uppercase;margin-bottom:6px">${esc(l.local)}</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:8px">${esc(fmtHTML(l.total))}</div>
          ${cats}
        </div>`;
    }).join('');

    const gfMap: Record<string, number> = Object.fromEntries(gastoFijoData.porLocal.map(l => [l.local, l.total]));
    const locales = Object.keys(current.porSucursal);
    let totV = 0, totGV = 0, totGF = 0;
    const rentRows = locales.map((nombre, i) => {
      const s  = current.porSucursal[nombre];
      const gf = gfMap[nombre] ?? 0;
      const rent = s.ventas - s.gastos - gf;
      totV += s.ventas; totGV += s.gastos; totGF += gf;
      const rentColor = rent >= 0 ? '#059669' : '#dc2626';
      return `
        <tr style="background:${i%2===1?'#f8fafc':'#ffffff'}">
          <td style="font-weight:600">${esc(nombre)}</td>
          <td class="right">${esc(fmtHTML(s.ventas))}</td>
          <td class="right" style="color:#d97706">${esc(fmtHTML(s.gastos))}</td>
          <td class="right" style="color:#0891b2">${esc(fmtHTML(gf))}</td>
          <td class="right" style="font-weight:700;color:${rentColor}">${esc(fmtHTML(rent))}</td>
        </tr>`;
    }).join('');
    const totalRent = totV - totGV - totGF;
    const totalRentColor = totalRent >= 0 ? '#059669' : '#dc2626';
    const totalRow = `
      <tr style="background:#f1f5f9;border-top:2px solid #334155">
        <td style="font-weight:800;font-size:14px">TOTAL</td>
        <td class="right" style="font-weight:800;font-size:14px">${esc(fmtHTML(totV))}</td>
        <td class="right" style="font-weight:800;font-size:14px;color:#d97706">${esc(fmtHTML(totGV))}</td>
        <td class="right" style="font-weight:800;font-size:14px;color:#0891b2">${esc(fmtHTML(totGF))}</td>
        <td class="right" style="font-weight:800;font-size:14px;color:${totalRentColor}">${esc(fmtHTML(totalRent))}</td>
      </tr>`;

    return `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#0891b2"></div>
        <span class="section-title">Gasto fijo del período</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:16px">
        ${localCards}
      </div>
      <div class="section-header" style="margin-top:16px">
        <div class="section-accent" style="background:#0f172a"></div>
        <span class="section-title">Rentabilidad por sucursal</span>
      </div>
      <table>
        <thead><tr>
          <th>Sucursal</th>
          <th class="right">Ventas</th>
          <th class="right">Gasto Variable</th>
          <th class="right">Gasto Fijo</th>
          <th class="right">Rentabilidad</th>
        </tr></thead>
        <tbody>${rentRows}${totalRow}</tbody>
      </table>
    </div>`;
  })() : '';

  const insightItems = insights.map(ins => {
    const cls = ins.type === 'positive' ? 'insight-pos' : ins.type === 'negative' ? 'insight-neg' : 'insight-warn';
    const col = ins.type === 'positive' ? '#059669' : ins.type === 'negative' ? '#dc2626' : '#d97706';
    return `
      <div class="insight ${cls}">
        <div class="insight-title" style="color:${col}">${esc(ins.titulo)}</div>
        <div class="insight-desc">${esc(ins.descripcion)}</div>
        ${ins.accion ? `<div class="insight-action">Acción: ${esc(ins.accion)}</div>` : ''}
      </div>`;
  }).join('');

  const insightSection = insights.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <div class="section-accent" style="background:#d97706"></div>
        <span class="section-title">Alertas e insights automáticos</span>
      </div>
      ${insightItems}
    </div>` : '';

  const aiSection = aiAnalysis ? `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#6d28d9"></div>
        <span class="section-title">Análisis inteligente</span>
      </div>
      ${aiAnalysis.resumen ? `
        <div class="ai-card ai-purple" style="margin-bottom:10px">
          <div class="ai-label" style="color:#6d28d9">Resumen ejecutivo</div>
          <p class="ai-text">${esc(aiAnalysis.resumen)}</p>
        </div>` : ''}
      ${aiAnalysis.comparacion ? `
        <div class="ai-card ai-neutral" style="margin-bottom:10px">
          <div class="ai-label" style="color:#64748b">Análisis comparativo</div>
          <p class="ai-text">${esc(aiAnalysis.comparacion)}</p>
        </div>` : ''}
      ${(aiAnalysis.problemas?.length ?? 0) > 0 ? `
        <div class="ai-card ai-red" style="margin-bottom:10px">
          <div class="ai-label" style="color:#dc2626">Problemas detectados</div>
          ${aiAnalysis.problemas!.map(p => `<div class="ai-item">• ${esc(p)}</div>`).join('')}
        </div>` : ''}
      ${(aiAnalysis.recomendaciones?.length ?? 0) > 0 ? `
        <div class="ai-card ai-green">
          <div class="ai-label" style="color:#059669">Recomendaciones</div>
          ${aiAnalysis.recomendaciones!.map((r, i) => `<div class="ai-item">${i+1}. ${esc(r)}</div>`).join('')}
        </div>` : ''}
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Informe FinanzasOca — ${fdHTML(data.filters.fechaDesde)} al ${fdHTML(data.filters.fechaHasta)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:#fff;color:#0f172a;font-size:13px;line-height:1.5}
@page{size:A4;margin:0}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .avoid-break{page-break-inside:avoid}
  .no-print{display:none}
}
.document{max-width:900px;margin:0 auto;background:#fff}
/* Header */
.header{background:#0f2147}
.header-stripe{height:4px;background:linear-gradient(90deg,#2563eb 0%,#7c3aed 50%,#059669 100%)}
.header-body{padding:28px 40px 24px;display:flex;justify-content:space-between;align-items:flex-end}
.header-brand{font-size:9px;font-weight:700;letter-spacing:.18em;color:#7dd3fc;text-transform:uppercase;margin-bottom:8px}
.header-title{font-size:28px;font-weight:800;color:#fff;letter-spacing:-.03em;line-height:1.1}
.header-sub{font-size:13px;color:#94a3b8;margin-top:6px}
.header-right{text-align:right}
.header-dates{font-size:18px;font-weight:700;color:#fff;letter-spacing:-.01em}
.header-suc{display:inline-block;font-size:11px;font-weight:600;color:#0f2147;background:#7dd3fc;padding:2px 10px;margin-top:6px}
.header-gen{font-size:11px;color:#64748b;margin-top:8px}
/* Body */
.body{padding:36px 40px;display:flex;flex-direction:column;gap:32px}
/* Section */
.section{break-inside:avoid}
.section-header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.section-accent{width:4px;height:18px;flex-shrink:0}
.section-title{font-size:10px;font-weight:700;letter-spacing:.08em;color:#475569;text-transform:uppercase}
/* KPI grid */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi-card{border:1px solid #e2e8f0;padding:14px 16px}
.kpi-label{font-size:9px;font-weight:700;letter-spacing:.1em;color:#94a3b8;text-transform:uppercase;margin-bottom:8px}
.kpi-value{font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-.02em;margin-bottom:10px}
/* Badge */
.badge{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;letter-spacing:.01em}
.badge-pos{color:#059669;background:#ecfdf5}
.badge-neg{color:#dc2626;background:#fff1f2}
.badge-neu{color:#94a3b8;background:#f1f5f9}
/* Tables */
table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;margin:0}
th{padding:10px 16px;font-size:10px;font-weight:700;color:#475569;background:#f8fafc;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #cbd5e1;text-align:left}
td{padding:11px 16px;border-bottom:1px solid #e2e8f0;color:#0f172a}
.right{text-align:right}
/* Insights */
.insight{padding:12px 16px;margin-bottom:8px}
.insight:last-child{margin-bottom:0}
.insight-pos{background:#ecfdf5;border-top:1px solid #6ee7b7;border-right:1px solid #6ee7b7;border-bottom:1px solid #6ee7b7;border-left:4px solid #059669}
.insight-neg{background:#fff1f2;border-top:1px solid #fecdd3;border-right:1px solid #fecdd3;border-bottom:1px solid #fecdd3;border-left:4px solid #dc2626}
.insight-warn{background:#fffbeb;border-top:1px solid #fde68a;border-right:1px solid #fde68a;border-bottom:1px solid #fde68a;border-left:4px solid #d97706}
.insight-title{font-weight:700;font-size:13px;margin-bottom:4px}
.insight-desc{font-size:12px;color:#475569;line-height:1.5}
.insight-action{font-size:12px;color:#475569;margin-top:6px;font-style:italic}
/* AI cards */
.ai-card{padding:16px 20px}
.ai-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}
.ai-text{font-size:13px;color:#0f172a;line-height:1.65}
.ai-item{font-size:13px;color:#0f172a;margin-bottom:6px;padding-left:12px}
.ai-purple{background:#f5f3ff;border-top:1px solid #c4b5fd;border-right:1px solid #c4b5fd;border-bottom:1px solid #c4b5fd;border-left:4px solid #6d28d9}
.ai-neutral{background:#f8fafc;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;border-left:4px solid #cbd5e1}
.ai-red{background:#fff1f2;border-top:1px solid #fecdd3;border-right:1px solid #fecdd3;border-bottom:1px solid #fecdd3;border-left:4px solid #dc2626}
.ai-green{background:#ecfdf5;border-top:1px solid #6ee7b7;border-right:1px solid #6ee7b7;border-bottom:1px solid #6ee7b7;border-left:4px solid #059669}
/* Footer */
.footer{border-top:1px solid #e2e8f0;padding-top:18px;display:flex;justify-content:space-between;align-items:center}
.footer-brand{font-size:11px;font-weight:700;color:#0f2147;letter-spacing:.05em}
.footer-text{font-size:11px;color:#94a3b8}
/* Print button */
.print-btn{position:fixed;bottom:24px;right:24px;background:#0f2147;color:#fff;border:none;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,.2)}
.print-btn:hover{background:#1e3a6e}
</style>
</head>
<body>
<div class="document">
  <!-- Header -->
  <div class="header">
    <div class="header-stripe"></div>
    <div class="header-body">
      <div>
        <div class="header-brand">FinanzasOca</div>
        <div class="header-title">Informe de Gestión</div>
        <div class="header-sub">Reporte ejecutivo de gestión financiera</div>
      </div>
      <div class="header-right">
        <div class="header-dates">${fdHTML(data.filters.fechaDesde)} — ${fdHTML(data.filters.fechaHasta)}</div>
        ${data.filters.sucursal ? `<div class="header-suc">${esc(data.filters.sucursal)}</div>` : ''}
        <div class="header-gen">Generado el ${new Date(data.generatedAt).toLocaleString('es-CL')}</div>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- KPIs -->
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#1d4ed8"></div>
        <span class="section-title">Indicadores clave del período</span>
      </div>
      <div class="kpi-grid">${kpiCards}</div>
    </div>

    <!-- Proyección de ventas -->
    ${proyeccion ? `
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#1d4ed8"></div>
        <span class="section-title">Proyección de ventas — día ${proyeccion.diaDelMes} de ${proyeccion.diasTotalesMes} (${proyeccion.diasRestantesMes} días restantes)</span>
      </div>
      <table>
        <thead><tr>
          <th>Sucursal</th>
          <th class="right">Ventas actuales</th>
          <th class="right">Prom. diario</th>
          <th class="right" style="color:#1d4ed8">Proyección cierre</th>
        </tr></thead>
        <tbody>
          ${proyeccion.porSucursal.map((s, i) => `
          <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
            <td style="font-weight:600">${s.nombre}</td>
            <td class="right">${fmtHTML(s.ventasActuales)}</td>
            <td class="right" style="color:#475569">${fmtHTML(s.promedioDiario)}</td>
            <td class="right" style="font-weight:700;color:#1d4ed8">${fmtHTML(s.ventasProyectadasMes)}</td>
          </tr>`).join('')}
          <tr style="background:#eff6ff;border-top:2px solid #bfdbfe">
            <td style="font-weight:800">TOTAL</td>
            <td class="right" style="font-weight:800">${fmtHTML(current.ventas)}</td>
            <td class="right" style="font-weight:700;color:#475569">${fmtHTML(proyeccion.promedioDiario)}</td>
            <td class="right" style="font-weight:800;font-size:15px;color:#1d4ed8">${fmtHTML(proyeccion.ventasProyectadasMes)}</td>
          </tr>
        </tbody>
      </table>
    </div>` : ''}

    <!-- Comparación -->
    <div class="section avoid-break">
      <div class="section-header">
        <div class="section-accent" style="background:#1d4ed8"></div>
        <span class="section-title">Comparación de períodos</span>
      </div>
      <table>
        <thead><tr>
          <th style="width:28%">Métrica</th>
          <th class="right">Período actual<div style="font-size:9px;font-weight:400;color:#94a3b8;margin-top:1px">${fdHTML(data.filters.fechaDesde)} – ${fdHTML(data.filters.fechaHasta)}</div></th>
          <th class="right">Período anterior<div style="font-size:9px;font-weight:400;color:#94a3b8;margin-top:1px">${fdHTML(data.periodoAnterior.fechaDesde)} – ${fdHTML(data.periodoAnterior.fechaHasta)}</div></th>
          <th class="right" style="width:14%">Variación</th>
        </tr></thead>
        <tbody>${compRows}</tbody>
      </table>
    </div>

    ${sucursalSection}
    ${provSection}
    ${mermaSection}
    ${produccionSection}
    ${gastoFijoSection}
    ${insightSection}
    ${aiSection}

    <!-- Footer -->
    <div class="footer">
      <span class="footer-brand">FINANZASOCA</span>
      <span class="footer-text">Informe generado el ${new Date(data.generatedAt).toLocaleString('es-CL')}</span>
      <span class="footer-text">Confidencial</span>
    </div>

  </div>
</div>

<button class="print-btn no-print" onclick="window.print()">
  ⬇ Guardar / Imprimir PDF
</button>
</body>
</html>`;
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function InformesPage() {
  const dates = defaultDates();
  const [fechaDesde, setFechaDesde] = useState(dates.desde);
  const [fechaHasta, setFechaHasta] = useState(dates.hasta);
  const [sucursal, setSucursal] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportHTML, setReportHTML] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [canAccessGastoFijo, setCanAccessGastoFijo] = useState(true);
  useEffect(() => { setCanAccessGastoFijo(getSessionPermissions().canAccessGastoFijo); }, []);

  const sucursales = ['', 'PV', 'La Reina', 'PT', 'Bilbao'];

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError('');
    setReportData(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout
    try {
      const params = new URLSearchParams({
        fechaDesde,
        fechaHasta,
        sucursal,
        tipo: 'completo',
      });
      const res = await fetch(`/api/informes/generate?${params}`, { signal: controller.signal, credentials: 'include' });
      if (!res.ok) { setError(`Error del servidor: ${res.status}`); return; }
      const data = await res.json();
      if (!data.ok) { setError(data.error ?? 'Error al generar informe'); return; }
      const rd: ReportData = { ...data, aiAnalysis: null };
      setReportData(rd);
      setReportHTML(buildReportHTML(rd));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('La generación tardó demasiado. Intenta de nuevo.');
      } else {
        setError('Error de conexión al servidor');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, sucursal]);

  const generateAI = useCallback(async () => {
    if (!reportData) return;
    setLoadingAI(true);
    try {
      const res = await fetch('/api/informes/ai-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: reportData.filters,
          current: reportData.current,
          previous: reportData.previous,
          deltaVentas: reportData.deltaVentas,
          deltaGastos: reportData.deltaGastos,
          deltaMargen: reportData.deltaMargen,
          insights: reportData.insights,
          mermaData: reportData.mermaData,
          produccionData: reportData.produccionData,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReportData(prev => {
          if (!prev) return prev;
          const updated = { ...prev, aiAnalysis: data.analysis };
          setReportHTML(buildReportHTML(updated));
          return updated;
        });
      } else {
        setError(data.error ?? 'Error al generar análisis IA');
      }
    } catch {
      setError('Error de conexión con el servicio de IA');
    } finally {
      setLoadingAI(false);
    }
  }, [reportData]);

  const exportPDF = useCallback(() => {
    iframeRef.current?.contentWindow?.print();
  }, []);

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-6xl mx-auto">
      {/* Header de página */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Informes</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Genera y exporta informes ejecutivos con análisis de IA</p>
        </div>
      </div>

      {/* Panel de filtros */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
              <Calendar className="w-3 h-3 inline mr-1" />Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
              <Calendar className="w-3 h-3 inline mr-1" />Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>
              <Building2 className="w-3 h-3 inline mr-1" />Sucursal
            </label>
            <select
              value={sucursal}
              onChange={e => setSucursal(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none"
              style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
            >
              {sucursales.map(s => (
                <option key={s} value={s}>{s || 'Todas las sucursales'}</option>
              ))}
            </select>
          </div>

          <button
            onClick={generateReport}
            disabled={loading || !fechaDesde || !fechaHasta}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white disabled:opacity-60 hover:bg-blue-700 transition-colors"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {loading ? 'Generando...' : 'Generar informe'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl p-4 mb-6 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Acciones del informe */}
      {reportData && (
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={generateAI}
            disabled={loadingAI || !!reportData.aiAnalysis}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-60 hover:opacity-80 transition-opacity"
            style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
          >
            {loadingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4 text-purple-500" />}
            {loadingAI ? 'Analizando con IA...' : reportData.aiAnalysis ? '✓ Análisis IA generado' : 'Generar análisis IA'}
          </button>

          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80 transition-opacity"
            style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
          >
            <Download className="w-4 h-4 text-green-500" />
            Descargar PDF
          </button>

          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:opacity-80 transition-opacity"
            style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
          >
            <Mail className="w-4 h-4 text-blue-500" />
            Enviar por correo
          </button>
        </div>
      )}

      {/* Vista previa del informe */}
      {reportHTML && (
        <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <iframe
            ref={iframeRef}
            srcDoc={reportHTML}
            style={{ width: '100%', minHeight: 600, display: 'block', border: 'none' }}
            onLoad={() => {
              const iframe = iframeRef.current;
              if (iframe?.contentDocument?.body) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 24 + 'px';
              }
            }}
          />
        </div>
      )}

      {/* Estado vacío */}
      {!reportData && !loading && !error && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: 'var(--text)' }} />
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>Selecciona un período y genera tu informe</p>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>El informe incluirá KPIs, comparaciones, insights automáticos y análisis de IA</p>
        </div>
      )}

      {/* Panel de automatización */}
      <AutomationPanel />

      {/* Modal de email */}
      {showEmailModal && reportData && (
        <EmailModal reportData={reportData} onClose={() => setShowEmailModal(false)} />
      )}
    </div>
  );
}
