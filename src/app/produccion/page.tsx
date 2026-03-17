'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import {
  Factory, TrendingUp, TrendingDown,
  DollarSign, Package, AlertTriangle, ChevronDown, Calendar,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ProduccionData {
  ok: boolean;
  kpi: {
    totalVentas: number;
    totalCostos: number;
    totalMerma:  number;
    rentabilidad: number;
    totalPedidos: number;
  };
  ventasPorMes:  { key: string; mes: string; ventas: number; pedidos: number }[];
  gastosPorMes:  { key: string; mes: string; monto: number }[];
  mermasPorMes:  { key: string; mes: string; monto: number }[];
  topProductos:  { nombre: string; categoria: string; unidades: number; ingresos: number }[];
  porArea:       { area: string; unidades: number; ingresos: number; color: string }[];
  porTipoMerma:  { tipo: string; monto: number; porcentaje: number; color: string }[];
  locales:       string[];
  mesDesde:      string;
  mesHasta:      string;
  error?:        string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1_000).toFixed(0)}k`;
const fmtFull = (v: number) => `$${v.toLocaleString('es-CL')}`;

// ─── Tooltip custom ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border px-4 py-3.5 text-[12px]"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border-2)',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.08)',
      }}>
      <p className="text-[10px] font-bold tracking-widest uppercase mb-2.5" style={{ color: 'var(--text-3)' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span style={{ color: 'var(--text-2)' }}>{p.name}</span>
          </div>
          <span className="font-bold" style={{ color: 'var(--text)' }}>{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <div className="rounded-2xl p-5 border flex items-start gap-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide mb-1"
          style={{ color: 'var(--text-3)' }}>{label}</p>
        {loading
          ? <div className="h-7 w-28 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
          : <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{value}</p>}
        {sub && !loading && (
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProduccionPage() {
  const [data, setData]       = useState<ProduccionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [local, setLocal]     = useState('Todos');
  const [localOpen, setLocalOpen] = useState(false);
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'dia'>('mes');

  // Defaults: mes actual y hace 2 meses
  const hoy = new Date();
  const defaultMesHasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  const defaultMesDesde = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
  const defaultFechaHasta = hoy.toISOString().slice(0, 10);
  const d3 = new Date(hoy); d3.setDate(d3.getDate() - 30);
  const defaultFechaDesde = d3.toISOString().slice(0, 10);

  const [mesDesde,   setMesDesde]   = useState(defaultMesDesde);
  const [mesHasta,   setMesHasta]   = useState(defaultMesHasta);
  const [fechaDesde, setFechaDesde] = useState(defaultFechaDesde);
  const [fechaHasta, setFechaHasta] = useState(defaultFechaHasta);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ local: local.toLowerCase() });
    if (modoFiltro === 'dia') {
      params.set('fechaDesde', fechaDesde);
      params.set('fechaHasta', fechaHasta);
    } else {
      params.set('mesDesde', mesDesde);
      params.set('mesHasta', mesHasta);
    }
    fetch(`/api/produccion-data?${params}`)
      .then(r => r.json())
      .then((d: ProduccionData) => {
        if (!d.ok) throw new Error(d.error ?? 'Error al cargar datos');
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [modoFiltro, mesDesde, mesHasta, fechaDesde, fechaHasta, local]);

  // ── Combinar meses para chart (ordenado por key YYYY-MM) ──────────────────
  const chartData = useMemo(() => {
    if (!data) return [];
    const allKeys = new Set([
      ...data.ventasPorMes.map(v => v.key),
      ...data.gastosPorMes.map(g => g.key),
      ...data.mermasPorMes.map(m => m.key),
    ]);
    const ventasMap  = Object.fromEntries(data.ventasPorMes.map(v => [v.key, { ventas: v.ventas, mes: v.mes }]));
    const gastosMap  = Object.fromEntries(data.gastosPorMes.map(g => [g.key, g.monto]));
    const mermaMap   = Object.fromEntries(data.mermasPorMes.map(m => [m.key, m.monto]));
    return [...allKeys].sort().map(key => ({
      mes: ventasMap[key]?.mes ?? data.gastosPorMes.find(g => g.key === key)?.mes ?? key,
      ventas: ventasMap[key]?.ventas ?? 0,
      costos: gastosMap[key] ?? 0,
      merma:  mermaMap[key]  ?? 0,
    }));
  }, [data]);

  const kpi = data?.kpi;

  return (
    <div className="flex-1 min-h-screen p-5 md:p-7 space-y-6"
      style={{ background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
              Producción
            </h1>
            <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
              Ventas · Costos · Merma
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Toggle modo mes / fecha */}
          <div className="flex rounded-xl border overflow-hidden text-[12px] font-medium"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <button
              onClick={() => setModoFiltro('mes')}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={modoFiltro === 'mes'
                ? { background: 'var(--active-bg)', color: 'var(--active-text)' }
                : { color: 'var(--text-3)' }}
            >
              Por mes
            </button>
            <button
              onClick={() => setModoFiltro('dia')}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
              style={modoFiltro === 'dia'
                ? { background: 'var(--active-bg)', color: 'var(--active-text)' }
                : { color: 'var(--text-3)' }}
            >
              <Calendar className="w-3 h-3" />
              Por fecha
            </button>
          </div>

          {/* Inputs según modo */}
          <div className="flex items-center gap-1.5">
            {modoFiltro === 'mes' ? (
              <>
                <input
                  type="month"
                  value={mesDesde}
                  max={mesHasta}
                  onChange={e => setMesDesde(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border text-[12px] font-medium"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>→</span>
                <input
                  type="month"
                  value={mesHasta}
                  min={mesDesde}
                  onChange={e => setMesHasta(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border text-[12px] font-medium"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                />
              </>
            ) : (
              <>
                <input
                  type="date"
                  value={fechaDesde}
                  max={fechaHasta}
                  onChange={e => setFechaDesde(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border text-[12px] font-medium"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                />
                <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>→</span>
                <input
                  type="date"
                  value={fechaHasta}
                  min={fechaDesde}
                  onChange={e => setFechaHasta(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border text-[12px] font-medium"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
                />
              </>
            )}
          </div>

          {/* Local */}
          {data?.locales && data.locales.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setLocalOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
              >
                <span>{local}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {localOpen && (
                <div className="absolute right-0 mt-1 rounded-xl border shadow-lg z-20 min-w-[130px] py-1 text-[12px]"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                  {data.locales.map(l => (
                    <button
                      key={l}
                      onClick={() => { setLocal(l); setLocalOpen(false); }}
                      className="w-full text-left px-4 py-2 transition-colors"
                      style={{ color: local === l ? 'var(--active-text)' : 'var(--text-2)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-[13px] text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Ventas"
          value={kpi ? fmt(kpi.totalVentas) : '—'}
          sub={kpi ? `${kpi.totalPedidos} pedidos` : undefined}
          icon={TrendingUp}
          color="bg-blue-500"
          loading={loading}
        />
        <KPICard
          label="Costos / Insumos"
          value={kpi ? fmt(kpi.totalCostos) : '—'}
          sub={kpi && kpi.totalVentas > 0
            ? `${Math.round((kpi.totalCostos / kpi.totalVentas) * 100)}% de ventas`
            : undefined}
          icon={DollarSign}
          color="bg-orange-500"
          loading={loading}
        />
        <KPICard
          label="Merma"
          value={kpi ? fmt(kpi.totalMerma) : '—'}
          sub={kpi && kpi.totalVentas > 0
            ? `${((kpi.totalMerma / kpi.totalVentas) * 100).toFixed(1)}% de ventas`
            : undefined}
          icon={AlertTriangle}
          color="bg-red-500"
          loading={loading}
        />
        <KPICard
          label="Rentabilidad"
          value={kpi ? `${kpi.rentabilidad}%` : '—'}
          sub="(Ventas - Costos - Merma) / Ventas"
          icon={kpi && kpi.rentabilidad >= 0 ? TrendingUp : TrendingDown}
          color={kpi && kpi.rentabilidad >= 20 ? 'bg-emerald-500' : kpi && kpi.rentabilidad >= 0 ? 'bg-yellow-500' : 'bg-red-500'}
          loading={loading}
        />
      </div>

      {/* ── Gráfico combinado por mes ─────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
          Evolución mensual — Ventas vs Costos vs Merma
        </h2>
        {loading
          ? <div className="h-56 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
          : chartData.length === 0
            ? <p className="text-center py-10 text-[13px]" style={{ color: 'var(--text-3)' }}>Sin datos para el período</p>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barCategoryGap="30%" barGap={3} maxBarSize={32}>
                  <CartesianGrid strokeDasharray="4 2" stroke="var(--chart-grid)" vertical={false} strokeWidth={1} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} dy={4} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--hover)', radius: 6 }} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '14px' }}
                    formatter={(v) => <span style={{ color: 'var(--chart-axis)' }}>{v}</span>} />
                  <Bar dataKey="ventas" name="Ventas"  fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="costos" name="Costos"  fill="#F97316" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="merma"  name="Merma"   fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
      </div>

      {/* ── Fila: Áreas de producción + Merma por tipo ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Áreas */}
        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
            Ventas por área de producción
          </h2>
          {loading
            ? <div className="h-44 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
            : !data?.porArea.length
              ? <p className="text-center py-10 text-[13px]" style={{ color: 'var(--text-3)' }}>Sin datos</p>
              : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                      <Pie data={data.porArea} dataKey="ingresos" nameKey="area"
                        cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                        paddingAngle={3} strokeWidth={0}>
                        {data.porArea.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmtFull(v)}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid var(--border-2)',
                          background: 'var(--card)',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                        itemStyle={{ color: 'var(--text)' }}
                        labelStyle={{ color: 'var(--text-3)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.porArea.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: a.color }} />
                          <span style={{ color: 'var(--text-2)' }}>{a.area}</span>
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>
                          {a.unidades.toLocaleString('es-CL')} u.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </div>

        {/* Merma por tipo */}
        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--text)' }}>
            Merma por tipo
          </h2>
          {loading
            ? <div className="h-44 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
            : !data?.porTipoMerma.length
              ? <p className="text-center py-10 text-[13px]" style={{ color: 'var(--text-3)' }}>Sin datos de merma</p>
              : (
                <div className="space-y-2.5">
                  {data.porTipoMerma.map((t, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: t.color }} />
                          <span style={{ color: 'var(--text-2)' }}>{t.tipo}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-semibold" style={{ color: 'var(--text)' }}>
                            {fmtFull(t.monto)}
                          </span>
                          <span className="text-[10px] font-bold min-w-[32px] text-right" style={{ color: t.color }}>
                            {t.porcentaje}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--chart-grid)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${t.porcentaje}%`, background: t.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </div>
      </div>

      {/* ── Top productos ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
            Top productos vendidos
          </h2>
        </div>
        {loading
          ? <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
          : !data?.topProductos.length
            ? <p className="text-center py-10 text-[13px]" style={{ color: 'var(--text-3)' }}>Sin datos de productos</p>
            : (
              <>
                {/* Gráfico de barras horizontal */}
                <ResponsiveContainer width="100%" height={Math.min(data.topProductos.length * 34, 340)}>
                  <BarChart
                    data={data.topProductos.slice(0, 10)}
                    layout="vertical"
                    barCategoryGap="25%"
                    maxBarSize={20}
                    margin={{ left: 10, right: 56 }}
                  >
                    <CartesianGrid strokeDasharray="4 2" stroke="var(--chart-grid)" horizontal={false} strokeWidth={1} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nombre" width={130}
                      tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === 'unidades' ? [`${v.toLocaleString('es-CL')} u.`, 'Unidades'] : [fmtFull(v), 'Ingresos']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-2)',
                        background: 'var(--card)',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="unidades" name="Unidades" fill="#3B82F6" radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="unidades" position="right"
                        style={{ fontSize: 10, fill: 'var(--text-3)', fontWeight: 600 }}
                        formatter={(v: number) => v.toLocaleString('es-CL')} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Tabla detalle */}
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Producto', 'Categoría', 'Unidades', 'Ingresos'].map(h => (
                          <th key={h} className="text-left pb-2 pr-4 font-semibold"
                            style={{ color: 'var(--text-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.topProductos.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="py-2 pr-4 font-medium" style={{ color: 'var(--text)' }}>
                            {p.nombre}
                          </td>
                          <td className="py-2 pr-4" style={{ color: 'var(--text-3)' }}>{p.categoria}</td>
                          <td className="py-2 pr-4 font-semibold" style={{ color: 'var(--text)' }}>
                            {p.unidades.toLocaleString('es-CL')}
                          </td>
                          <td className="py-2 font-semibold" style={{ color: 'var(--text)' }}>
                            {fmtFull(p.ingresos)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
      </div>
    </div>
  );
}
