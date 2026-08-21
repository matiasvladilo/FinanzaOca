'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Download, Bell, ChevronDown,
  CheckCircle2, AlertTriangle, TrendingDown, TrendingUp, X,
  Sun, Moon, Sparkles, Check, GitCompare,
} from 'lucide-react';
import clsx from 'clsx';
import { PeriodSelect } from '@/components/ui/PeriodSelect';
import { ComparisonPanel } from '@/components/ui/ComparisonPanel';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';
import { useTheme } from '@/providers/ThemeProvider';

// ── Helpers ───────────────────────────────────────────────────────────────────
const MESES_FULL: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo',  '06': 'Junio',   '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};
function mesLabel(key: string) {
  const [anio, mes] = key.split('-');
  return (MESES_FULL[mes] ?? mes) + ' ' + anio;
}

const SUC_COLORS: Record<string, string> = {
  'La Reina': '#2563EB',   // azul
  'PV':       '#10B981',   // verde
  'PT':       '#D97706',   // naranjo
  'Bilbao':   '#7C3AED',   // morado
};
function getSucColor(suc: string, i: number) {
  return SUC_COLORS[suc] ?? ['#6366F1', '#EC4899', '#14B8A6', '#F97316'][i % 4];
}

const THEME_META = {
  light:   { icon: <Moon      className="w-4 h-4" />, next: 'Oscuro'  },
  dark:    { icon: <Sun       className="w-4 h-4" />, next: 'Dracula' },
  dracula: { icon: <Sparkles  className="w-4 h-4" />, next: 'Claro'   },
} as const;

// ── Chart sub-components ──────────────────────────────────────────────────────
const CustomDot = (props: any) => {
  const { cx, cy, value } = props;
  if (cx == null || cy == null || value == null) return null;
  return (
    <circle cx={cx} cy={cy} r={5}
      fill={value <= 60 ? '#22C55E' : '#EF4444'}
      stroke="#fff" strokeWidth={2} />
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fmtMoney = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
  return (
    <div style={{
      background: 'rgba(10,14,28,0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      padding: '10px 14px',
      minWidth: 185,
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)', letterSpacing: '-0.01em' }}>
        {label}
      </p>
      {payload.map((p: any) => {
        const ventas = p.payload[`__ventas_${p.dataKey}`];
        const gastos = p.payload[`__gastos_${p.dataKey}`];
        const isRisk = p.value > 60;
        return (
          <div key={p.dataKey} style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: p.color,
                display: 'inline-block', flexShrink: 0,
                boxShadow: `0 0 6px ${p.color}88`,
              }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{p.dataKey}</span>
              <span style={{
                marginLeft: 'auto',
                fontWeight: 800,
                fontSize: 13,
                color: isRisk ? '#f87171' : '#4ade80',
                letterSpacing: '-0.02em',
              }}>
                {p.value}%
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                padding: '2px 5px', borderRadius: 20,
                background: isRisk ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                color: isRisk ? '#f87171' : '#4ade80',
              }}>
                {isRisk ? 'RIESGO' : 'OK'}
              </span>
            </div>
            {ventas != null && (
              <div style={{ paddingLeft: 16, fontSize: 10, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 10 }}>
                <span><span style={{ color: '#60a5fa' }}>V:</span> {fmtMoney(ventas)}</span>
                <span><span style={{ color: '#f87171' }}>G:</span> {fmtMoney(gastos)}</span>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
        Verde ≤60% · Rojo &gt;60%
      </div>
    </div>
  );
};

type Modo = 'semana' | 'dia';

interface Alerta {
  key: string;          // "{sucursal}-{periodo}" — estable entre renders para el dismiss/ack
  local: string;
  periodo: string;      // etiqueta del período real (semana o día), no una hora inventada
  idx: number;
  ventas: number;
  gastos: number;
  tipo: 'critical' | 'warning';
}

/**
 * Genera alertas a partir de indice50Data — antes esta lista era 3 objetos
 * fijos en el código, con porcentajes y horarios ("Hoy, 10:45 AM") inventados
 * que nunca cambiaban. Cada fila con índice > 60% en el período/local
 * visible se vuelve una alerta real, con las ventas y gastos que la explican.
 *
 * El corte critical/warning (20 puntos sobre el umbral) es una elección
 * simple y ajustable, no una regla de negocio definida — no hay un criterio
 * "oficial" de severidad más allá del umbral de 60% que ya usa el resto de
 * la página.
 */
function calcularAlertas(
  indice50Data: Record<string, any>[],
  sucursales: string[],
): Alerta[] {
  const alertas: Alerta[] = [];
  for (const row of indice50Data) {
    for (const suc of sucursales) {
      const idx = row[suc];
      if (idx === undefined || idx <= 60) continue;
      alertas.push({
        idx,
        key: `${suc}-${row.semana}`,
        local: suc,
        periodo: row.semana,
        ventas: row[`__ventas_${suc}`] ?? 0,
        gastos: row[`__gastos_${suc}`] ?? 0,
        tipo: idx >= 80 ? 'critical' : 'warning',
      });
    }
  }
  // Peor primero: es lo que hay que mirar antes.
  return alertas.sort((a, b) => b.idx - a.idx);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FactorIndicePage() {
  const { theme, cycle } = useTheme();
  const themeMeta = THEME_META[theme];

  // Reconocer/descartar una alerta es sólo de esta sesión — no hay backend
  // para persistirlo, y no correspondería fingir que sí. Se guarda por `key`
  // (sucursal+período), no por índice de array, para que sobreviva a que la
  // lista se recalcule con datos nuevos.
  const [alertStatus, setAlertStatus] = useState<Record<string, 'acknowledged' | 'dismissed'>>({});
  const [showModal, setShowModal]   = useState(false);
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [mesSeleccionado, setMes]   = useState('');
  const [modo, setModo]             = useState<Modo>('semana');
  const [sucOpen, setSucOpen]       = useState(false);
  const [sucSel, setSucSel]         = useState<string[]>([]);   // vacío = todas
  const [cierreCajaData, setCCData] = useState<any>(null);
  const [ventasData, setVData]      = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  // ── Comparación ─────────────────────────────────────────────────────────
  const [compOn, setCompOn]   = useState(false);
  const [compMes2, setCompMes2] = useState('');

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ]).then(([cc, v]) => {
      setCCData(cc);
      setVData(v);
      if (cc.mesesDisponibles?.length) {
        const ultimo = [...cc.mesesDisponibles].sort().at(-1);
        if (ultimo) setMes(ultimo);
      }
    }).catch(() => toast('Error cargando datos', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Compute index data ──────────────────────────────────────────────────────
  const { indice50Data, allSucs } = useMemo(() => {
    if (!cierreCajaData?.registrosDiarios || !mesSeleccionado)
      return { indice50Data: [], allSucs: [] };

    const diasCaja:   any[] = cierreCajaData.registrosDiarios  ?? [];
    const diasGastos: any[] = ventasData?.registrosDiariosGastos ?? [];

    const ventasSS: Record<string, Record<string, number>> = {};
    const gastosSS: Record<string, Record<string, number>> = {};

    for (const r of diasCaja) {
      if (!r.fecha?.startsWith(mesSeleccionado)) continue;
      const dia = parseInt(r.fecha.slice(8, 10), 10);
      const k   = modo === 'semana' ? String(Math.ceil(dia / 7)) : r.fecha;
      if (!ventasSS[r.local]) ventasSS[r.local] = {};
      ventasSS[r.local][k] = (ventasSS[r.local][k] ?? 0) + r.ventas;
    }

    for (const r of diasGastos) {
      if (!r.fecha?.startsWith(mesSeleccionado)) continue;
      const dia = parseInt(r.fecha.slice(8, 10), 10);
      const k   = modo === 'semana' ? String(Math.ceil(dia / 7)) : r.fecha;
      if (!gastosSS[r.sucursal]) gastosSS[r.sucursal] = {};
      gastosSS[r.sucursal][k] = (gastosSS[r.sucursal][k] ?? 0) + r.monto;
    }

    const allSucs = [...new Set([...Object.keys(ventasSS), ...Object.keys(gastosSS)])].sort();

    // Collect all time keys from ventas
    const keySet = new Set<string>();
    Object.values(ventasSS).forEach(s => Object.keys(s).forEach(k => keySet.add(k)));
    const keys = [...keySet].sort((a, b) =>
      modo === 'semana' ? Number(a) - Number(b) : a.localeCompare(b)
    );

    const rows = keys.map(k => {
      const label = modo === 'semana'
        ? `S${k}`
        : `${parseInt(k.slice(8, 10))}/${parseInt(k.slice(5, 7))}`;
      const row: Record<string, any> = { semana: label };
      for (const suc of allSucs) {
        const ventas = ventasSS[suc]?.[k] ?? 0;
        const gastos = gastosSS[suc]?.[k] ?? 0;
        if (ventas > 0) row[suc] = parseFloat(((gastos / ventas) * 100).toFixed(1));
        row[`__ventas_${suc}`] = ventas;
        row[`__gastos_${suc}`] = gastos;
      }
      return row;
    });

    return { indice50Data: rows, allSucs };
  }, [cierreCajaData, ventasData, mesSeleccionado, modo]);

  // ── Init selection ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (allSucs.length > 0 && sucSel.length === 0) setSucSel(allSucs);
  }, [allSucs]); // eslint-disable-line

  const sucursalesVisibles = sucSel.length > 0 ? sucSel : allSucs;

  // ── Zoom con rueda ──────────────────────────────────────────────────────────
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Reset zoom cuando cambian los datos
  useEffect(() => { setZoomRange(null); }, [indice50Data]);

  const visibleChartData = useMemo(() => {
    if (!zoomRange || indice50Data.length === 0) return indice50Data;
    return indice50Data.slice(zoomRange.start, zoomRange.end + 1);
  }, [indice50Data, zoomRange]);

  const handleChartWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    if (indice50Data.length < 2) return;
    const total = indice50Data.length;
    const cur = zoomRange ?? { start: 0, end: total - 1 };
    const range = cur.end - cur.start;
    const step = Math.max(1, Math.floor(range * 0.18));
    const zoomIn = e.deltaY < 0;

    if (zoomIn) {
      const newStart = Math.min(cur.start + step, cur.end - 1);
      const newEnd   = Math.max(cur.end   - step, cur.start + 1);
      if (newEnd - newStart >= 1) setZoomRange({ start: newStart, end: newEnd });
    } else {
      const newStart = Math.max(0, cur.start - step);
      const newEnd   = Math.min(total - 1, cur.end + step);
      if (newStart === 0 && newEnd === total - 1) setZoomRange(null);
      else setZoomRange({ start: newStart, end: newEnd });
    }
  }, [indice50Data, zoomRange]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleChartWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleChartWheel);
  }, [handleChartWheel]);

  // ── Factor global (filtered) ────────────────────────────────────────────────
  const { factorGlobal, totalVentas, totalGastos } = useMemo(() => {
    if (!cierreCajaData?.registrosDiarios || !mesSeleccionado)
      return { factorGlobal: null, totalVentas: 0, totalGastos: 0 };

    const diasCaja:   any[] = cierreCajaData.registrosDiarios  ?? [];
    const diasGastos: any[] = ventasData?.registrosDiariosGastos ?? [];
    const todasSucs = sucSel.length === 0 || sucSel.length === allSucs.length;

    const tv = diasCaja
      .filter((r: any) => r.fecha?.startsWith(mesSeleccionado) && (todasSucs || sucSel.includes(r.local)))
      .reduce((s: number, r: any) => s + r.ventas, 0);
    // Usar gastosPorMesSucursal del server (usa col 'mes' del sheet — más preciso que filtrar por fecha.iso)
    const gastosMesSuc: Record<string, Record<string, number>> = ventasData?.gastosPorMesSucursal ?? {};
    let tg = 0;
    if (todasSucs) {
      tg = ventasData?.gastosPorMes?.[mesSeleccionado] ?? 0;
    } else {
      for (const suc of sucSel) tg += gastosMesSuc[suc]?.[mesSeleccionado] ?? 0;
    }
    const f = tv > 0 ? parseFloat(((tg / tv) * 100).toFixed(1)) : null;
    return { factorGlobal: f, totalVentas: tv, totalGastos: tg };
  }, [cierreCajaData, ventasData, mesSeleccionado, sucSel, allSucs]);

  // ── Factor del período de comparación ────────────────────────────────────
  const compFactorData = useMemo(() => {
    if (!compOn || !compMes2 || !cierreCajaData?.registrosDiarios) return null;
    const diasCaja:   any[] = cierreCajaData.registrosDiarios   ?? [];
    const diasGastos: any[] = ventasData?.registrosDiariosGastos ?? [];
    const todasSucs = sucSel.length === 0 || sucSel.length === allSucs.length;

    const tv = diasCaja
      .filter((r: any) => r.fecha?.startsWith(compMes2) && (todasSucs || sucSel.includes(r.local)))
      .reduce((s: number, r: any) => s + r.ventas, 0);

    const gastosMesSuc: Record<string, Record<string, number>> = ventasData?.gastosPorMesSucursal ?? {};
    let tg = 0;
    if (todasSucs) {
      tg = ventasData?.gastosPorMes?.[compMes2] ?? 0;
    } else {
      for (const suc of sucSel) tg += gastosMesSuc[suc]?.[compMes2] ?? 0;
    }
    const factor = tv > 0 ? parseFloat(((tg / tv) * 100).toFixed(1)) : null;
    return { factor, totalVentas: tv, totalGastos: tg };
  }, [cierreCajaData, ventasData, compMes2, compOn, sucSel, allSucs]);

  const isOpt       = factorGlobal !== null && factorGlobal < 60;
  const mesesDisp   = cierreCajaData?.mesesDisponibles ?? [];
  const fmt         = (v: number) => v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(1)}M`
    : `$${Math.round(v / 1000)}k`;

  // ── Alertas reales, calculadas del mismo indice50Data que dibuja el gráfico ──
  const alertList = useMemo(() => {
    const calculadas = calcularAlertas(indice50Data, sucursalesVisibles);
    return calculadas
      .filter(a => alertStatus[a.key] !== 'dismissed')
      .map(a => ({ ...a, acknowledged: alertStatus[a.key] === 'acknowledged' }));
  }, [indice50Data, sucursalesVisibles, alertStatus]);
  const activeAlerts = alertList.filter(a => !a.acknowledged).length;

  const handleExport = () => {
    exportToCSV(
      indice50Data.map(d => ({
        [modo === 'semana' ? 'Semana' : 'Fecha']: d.semana,
        ...Object.fromEntries(sucursalesVisibles.map(s => [s, d[s] != null ? d[s] + '%' : '—'])),
      })),
      `indice50_${modo}`
    );
    toast('Reporte exportado correctamente');
  };

  const toggleSuc = (s: string) =>
    setSucSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 sticky top-0 z-30 transition-colors"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-[16px] sm:text-[18px] font-bold" style={{ color: 'var(--text)' }}>Factor Índice Overview</h1>
        <div className="flex items-center gap-2">
          <button className="relative p-2 transition-colors" style={{ color: 'var(--text-3)' }}>
            <Bell className="w-4 h-4" />
            {activeAlerts > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
          </button>
          {/* Theme toggle */}
          <button onClick={cycle} title={`Cambiar a ${themeMeta.next}`}
            className="w-9 h-9 flex items-center justify-center rounded-full border transition-all"
            style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--active-text)'; (e.currentTarget as HTMLElement).style.color = 'var(--active-text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}>
            {themeMeta.icon}
          </button>
        </div>
      </header>

      {/* ── Subheader filters ── */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-6 py-3 gap-2 sm:gap-3 transition-colors"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}>

        <div className="flex flex-wrap items-center gap-2">

          {/* Month selector - Lista desplegable */}
          <PeriodSelect
            label="Mes"
            value={mesSeleccionado}
            options={[...mesesDisp].sort().map((m: string) => ({ label: mesLabel(m), value: m }))}
            onChange={setMes}
            allLabel="Todos los meses"
          />

          {/* Modo toggle */}
          <div className="flex items-center rounded-full p-1 gap-1" style={{ background: 'var(--hover)' }}>
            {(['semana', 'dia'] as Modo[]).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                style={modo === m
                  ? { background: 'var(--card)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: 'var(--text-3)' }}>
                {m === 'semana' ? 'Por Semana' : 'Por Día'}
              </button>
            ))}
          </div>

          {/* Sucursal multi-select */}
          <div className="relative">
            <button onClick={() => setSucOpen(!sucOpen)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-[12px] transition-colors"
              style={{ border: '1px solid var(--border-2)', background: 'var(--card)', color: 'var(--text-2)' }}>
              <span style={{ color: 'var(--text-3)' }} className="font-medium">Local:</span>
              <span className="font-semibold">
                {sucSel.length === 0 || sucSel.length === allSucs.length
                  ? 'Todos'
                  : sucSel.length === 1
                    ? sucSel[0]
                    : `${sucSel.length} seleccionados`}
              </span>
              <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-3)' }} />
            </button>
            {sucOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSucOpen(false)} />
                <div className="absolute left-0 top-full mt-1 rounded-xl shadow-lg z-50 min-w-[180px] py-1"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  {/* All option */}
                  <button
                    onClick={() => setSucSel(allSucs)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors"
                    style={{ color: 'var(--text-2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <span className={clsx(
                      'w-4 h-4 rounded flex items-center justify-center border',
                      sucSel.length === allSucs.length ? 'bg-blue-500 border-blue-500' : ''
                    )} style={sucSel.length !== allSucs.length ? { borderColor: 'var(--border-2)' } : {}}>
                      {sucSel.length === allSucs.length && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="font-semibold">Todos</span>
                  </button>
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  {allSucs.map((s, i) => (
                    <button key={s} onClick={() => toggleSuc(s)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors"
                      style={{ color: 'var(--text-2)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span className={clsx(
                        'w-4 h-4 rounded flex items-center justify-center border',
                        sucSel.includes(s) ? 'border-transparent' : ''
                      )} style={sucSel.includes(s)
                        ? { backgroundColor: getSucColor(s, i), borderColor: 'transparent' }
                        : { borderColor: 'var(--border-2)' }}>
                        {sucSel.includes(s) && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getSucColor(s, i) }} />
                        {s}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Toggle comparación */}
        <button
          onClick={() => {
            const next = !compOn;
            setCompOn(next);
            if (next && !compMes2) {
              const sorted = [...mesesDisp].sort();
              const idx = mesSeleccionado ? sorted.indexOf(mesSeleccionado) : sorted.length - 1;
              setCompMes2(idx > 0 ? sorted[idx - 1] : sorted[0] ?? '');
            }
          }}
          className={clsx(
            'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
            compOn
              ? 'bg-purple-600 border-purple-600 text-white'
              : 'text-gray-600 hover:border-purple-400 hover:text-purple-600',
          )}
          style={!compOn ? { background: 'var(--card)', borderColor: 'var(--border-2)' } : undefined}
        >
          <GitCompare className="w-3.5 h-3.5 opacity-80" />
          <span className="font-semibold text-[11px]">Comparar</span>
        </button>

        {/* Selector mes de comparación */}
        {compOn && mesesDisp.length > 0 && (
          <PeriodSelect
            label="vs"
            value={compMes2}
            options={[...mesesDisp].sort().map((m: string) => ({ label: mesLabel(m), value: m }))}
            onChange={setCompMes2}
            allLabel="Seleccionar mes"
          />
        )}

        {/* Export */}
        <button onClick={handleExport}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-[12px] font-semibold transition-colors shadow-sm"
          style={{ background: 'var(--active-text)', color: '#fff' }}>
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exportar</span>
        </button>
      </div>

      {/* ── Main ── */}
      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* ── Panel de Comparación ── */}
        {compOn && compFactorData && (
          <ComparisonPanel
            labelA={mesSeleccionado ? mesLabel(mesSeleccionado) : 'Período A'}
            labelB={compMes2 ? mesLabel(compMes2) : '—'}
            colorA="#3B82F6"
            colorB="#8B5CF6"
            loading={loading}
            metrics={[
              {
                label: 'Factor Índice',
                valueA: factorGlobal,
                valueB: compFactorData.factor,
                format: v => v.toFixed(1) + '%',
                higherIsBetter: false,
              },
              {
                label: 'Ventas',
                valueA: totalVentas,
                valueB: compFactorData.totalVentas,
                format: fmt,
                higherIsBetter: true,
              },
              {
                label: 'Gastos',
                valueA: totalGastos,
                valueB: compFactorData.totalGastos,
                format: fmt,
                higherIsBetter: false,
              },
            ]}
          />
        )}

        {/* ── Hero: Factor Índice ──────────────────────────────────────────────
             Antes este número (y su inverso, "Margen Bruto") aparecían tres
             veces en la pantalla: acá, en la tarjeta "Comparación Ventas vs
             Gastos" y en la línea de referencia del gráfico. Se muestra una
             sola vez, grande, como titular — todo lo demás es apoyo. */}
        <div className="rounded-2xl p-6 sm:p-8 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-3)' }}>
                Factor Índice{mesSeleccionado ? ` · ${mesLabel(mesSeleccionado)}` : ''}
              </p>
              <div className="flex items-end gap-3 flex-wrap">
                <p className="text-[52px] sm:text-[64px] font-black leading-none"
                  style={{ color: loading ? 'var(--text-3)' : isOpt ? 'var(--text)' : '#EF4444' }}>
                  {loading ? '…' : factorGlobal !== null ? `${factorGlobal}%` : '—'}
                </p>
                {factorGlobal !== null && !loading && (
                  <div className="flex items-center gap-1.5 pb-2">
                    {isOpt ? <TrendingDown className="w-4 h-4 text-green-500" /> : <TrendingUp className="w-4 h-4 text-red-500" />}
                    <span className={clsx('text-[13px] font-bold', isOpt ? 'text-green-600' : 'text-red-500')}>
                      {isOpt ? 'Bajo umbral' : 'Sobre umbral'}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
                (Gastos / Ventas) × 100 · objetivo &lt;60%
                {sucSel.length > 0 && sucSel.length < allSucs.length
                  ? <span className="ml-1" style={{ color: 'var(--active-text)' }}>· {sucSel.join(', ')}</span>
                  : <span className="ml-1">· sin Producción</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold',
                loading ? 'border-gray-300 text-gray-400' :
                  isOpt ? 'border-green-400 text-green-600' : 'border-red-400 text-red-600'
              )}>
                {isOpt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {loading ? '…' : isOpt ? 'OPTIMIZADO' : 'EN RIESGO'}
              </div>
              <button onClick={() => setShowModal(true)}
                className="py-1.5 px-3 rounded-xl text-[12px] font-semibold transition-all"
                style={{ border: '1.5px solid var(--border-2)', color: 'var(--text-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--active-text)'; (e.currentTarget as HTMLElement).style.color = 'var(--active-text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}>
                Ver Detalle
              </button>
            </div>
          </div>

          {factorGlobal !== null && (
            <div className="mb-6">
              <div className="flex justify-between text-[10px] mb-1.5" style={{ color: 'var(--text-3)' }}>
                <span>0%</span><span className="font-semibold" style={{ color: 'var(--text-2)' }}>umbral 60%</span><span>100%</span>
              </div>
              <div className="w-full rounded-full h-2.5 relative" style={{ background: 'var(--hover)' }}>
                <div className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(factorGlobal, 100)}%`, background: isOpt ? 'var(--active-text)' : '#EF4444' }} />
                <div className="absolute top-0 w-0.5 h-2.5" style={{ left: '60%', background: 'var(--text-3)' }} />
              </div>
            </div>
          )}

          {/* Ventas / gastos — el detalle que explica el número de arriba, sin repetirlo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>Ventas Brutas</span>
                <span className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>{loading ? '…' : fmt(totalVentas)}</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: 'var(--hover)' }}>
                <div className="h-2 rounded-full" style={{ width: '100%', background: 'var(--active-text)' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-3)' }}>Gastos Operacionales</span>
                <span className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>{loading ? '…' : fmt(totalGastos)}</span>
              </div>
              <div className="w-full rounded-full h-2" style={{ background: 'var(--hover)' }}>
                <div className="h-2 rounded-full transition-all duration-700" style={{
                  background: isOpt ? 'var(--active-text)' : '#EF4444',
                  width: totalVentas > 0 ? `${Math.min((totalGastos / totalVentas) * 100, 100)}%` : '0%',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Alertas: franja compacta, expandible ──────────────────────────────
             Antes era una tarjeta entera compitiendo en tamaño con el número
             principal. Colapsada muestra sólo el peor caso; el resto queda a
             un click, no metido en la cara todo el tiempo. */}
        {!loading && alertList.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <button onClick={() => setAlertasAbiertas(o => !o)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hover)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="flex-1 text-[12px] leading-snug min-w-0" style={{ color: 'var(--text)' }}>
                <span className="font-bold">
                  {activeAlerts} {activeAlerts === 1 ? 'local sobre el umbral' : 'locales sobre el umbral'}
                </span>
                {alertList[0] && (
                  <span style={{ color: 'var(--text-3)' }}>
                    {' '}— peor caso: {alertList[0].local} {alertList[0].idx}% en {alertList[0].periodo}
                  </span>
                )}
              </p>
              <ChevronDown className={clsx('w-4 h-4 flex-shrink-0 transition-transform', alertasAbiertas && 'rotate-180')}
                style={{ color: 'var(--text-3)' }} />
            </button>

            {alertasAbiertas && (
              <div className="p-4 pt-1 space-y-3 max-h-96 overflow-y-auto" style={{ borderTop: '1px solid var(--border)' }}>
                {alertList.map(a => (
                  <div key={a.key} className={clsx('rounded-xl p-4 mt-3', a.acknowledged ? 'opacity-60' : '')}
                    style={{ border: '1px solid var(--border-2)', background: a.acknowledged ? 'var(--hover)' : 'var(--card)' }}>
                    <div className="flex items-start justify-between mb-1">
                      <p className={clsx('text-[12px] font-bold', a.tipo === 'critical' ? 'text-red-500' : 'text-orange-500')}>
                        {a.local} sobre el umbral
                      </p>
                      <span className="text-[10px] whitespace-nowrap ml-2" style={{ color: 'var(--text-3)' }}>{a.periodo}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text-2)' }}>
                      Índice de {a.idx}% en {a.periodo} — gastos {fmt(a.gastos)} sobre ventas {fmt(a.ventas)}.
                    </p>
                    {!a.acknowledged ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setAlertStatus(prev => ({ ...prev, [a.key]: 'acknowledged' }))}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors">
                          Reconocer
                        </button>
                        <button onClick={() => setAlertStatus(prev => ({ ...prev, [a.key]: 'dismissed' }))}
                          className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors"
                          style={{ border: '1px solid var(--border-2)', color: 'var(--text-2)' }}>
                          Descartar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>✓ Reconocida</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chart — full width */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                Índice 60 por {modo === 'semana' ? 'Semana' : 'Día'}
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                (Gastos / Ventas) × 100 · punto verde ≤60% · rojo &gt;60% · sólo los 4 locales, sin Producción
              </p>
            </div>
            <div className="flex items-center gap-3">
              {zoomRange && (
                <button
                  onClick={() => setZoomRange(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                  title="Doble clic para restablecer"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#818cf8" strokeWidth="1.5"/><line x1="4" y1="6" x2="8" y2="6" stroke="#818cf8" strokeWidth="1.5"/></svg>
                  Restablecer zoom
                </button>
              )}
              <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-3)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Eficiente ≤60%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Riesgo &gt;60%
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-[300px] rounded-xl animate-pulse" style={{ background: 'var(--hover)' }} />
          ) : indice50Data.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>Sin datos para el período seleccionado</p>
            </div>
          ) : (
            <div
              ref={chartContainerRef}
              onDoubleClick={() => setZoomRange(null)}
              style={{ cursor: zoomRange ? 'zoom-out' : 'crosshair', userSelect: 'none' }}
            >
              {zoomRange && (
                <div style={{ textAlign: 'center', marginBottom: 4, fontSize: 10, color: 'rgba(129,140,248,0.7)', letterSpacing: '0.04em' }}>
                  {visibleChartData[0]?.semana} → {visibleChartData[visibleChartData.length - 1]?.semana}
                  &nbsp;·&nbsp;{visibleChartData.length} de {indice50Data.length} períodos
                  &nbsp;·&nbsp;rueda para ajustar · doble clic para restablecer
                </div>
              )}
              {!zoomRange && indice50Data.length > 1 && (
                <div style={{ textAlign: 'center', marginBottom: 4, fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.03em' }}>
                  Usá la rueda del mouse sobre el gráfico para hacer zoom
                </div>
              )}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={visibleChartData} style={{ background: 'transparent' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 'auto']}
                    tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`}
                    width={38}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 3' }}
                    wrapperStyle={{ outline: 'none' }}
                    animationDuration={100}
                  />
                  <Legend iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    formatter={v => <span style={{ color: 'var(--chart-axis)' }}>{v}</span>} />
                  <ReferenceLine
                    y={60} stroke="#EF4444" strokeWidth={1.5} strokeDasharray="6 3"
                    label={{ value: '60', position: 'insideTopRight', fontSize: 10, fill: '#EF4444', fontWeight: 700 }}
                  />
                  {sucursalesVisibles.map((suc, i) => (
                    <Line
                      key={suc}
                      type="monotone"
                      dataKey={suc}
                      name={suc}
                      stroke={getSucColor(suc, i)}
                      strokeWidth={2.5}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls
                      animationDuration={300}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </main>

      {/* ── Modal: Detalle por semana/día ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>
                Índice 60 por {modo === 'semana' ? 'Semana' : 'Día'} — {mesSeleccionado ? mesLabel(mesSeleccionado) : ''}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ color: 'var(--text-3)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {indice50Data.length > 0 ? (
              <div className="space-y-2">
                {indice50Data.map(d => {
                  const fmtM = (v: number) => v >= 1_000_000
                    ? `$${(v / 1_000_000).toFixed(2)}M`
                    : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;
                  return (
                    <div key={d.semana} className="rounded-xl p-3"
                      style={{ border: '1px solid var(--border)', background: 'var(--hover)' }}>
                      <p className="text-[12px] font-bold mb-2" style={{ color: 'var(--text-2)' }}>{d.semana}</p>
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sucursalesVisibles.length, 4)}, 1fr)` }}>
                        {sucursalesVisibles.map((s, i) => {
                          const ventas = d[`__ventas_${s}`] ?? 0;
                          const gastos = d[`__gastos_${s}`] ?? 0;
                          const idx    = d[s];
                          return (
                            <div key={s} className="rounded-lg p-2.5"
                              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getSucColor(s, i) }} />
                                <p className="text-[10px] font-bold" style={{ color: 'var(--text-3)' }}>{s}</p>
                              </div>
                              <p className={clsx('text-[18px] font-black',
                                // Mismo umbral que el gráfico y la tarjeta de arriba (60%) — antes decía
                                // 50 acá y 60 en todo el resto de la página: un 55% se veía verde en el
                                // gráfico y rojo en este detalle, mismo número, dos lecturas contradictorias.
                                idx !== undefined ? (idx <= 60 ? 'text-green-500' : 'text-red-500') : '')}
                                style={idx === undefined ? { color: 'var(--text-3)' } : undefined}>
                                {idx !== undefined ? `${idx}%` : '—'}
                              </p>
                              <div className="mt-1 space-y-0.5">
                                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                                  <span className="text-blue-400">V:</span> {ventas > 0 ? fmtM(ventas) : '—'}
                                </p>
                                <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                                  <span className="text-red-400">G:</span> {gastos > 0 ? fmtM(gastos) : '—'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-center py-8" style={{ color: 'var(--text-3)' }}>Sin datos</p>
            )}

            <button onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
