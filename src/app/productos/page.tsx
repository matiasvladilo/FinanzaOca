'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, LineChart, Line,
} from 'recharts';
import {
  Search, Bell,
  ChevronLeft, ChevronRight, Download, Star,
  TrendingUp, Activity, LayoutGrid, Package, Calendar,
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';


// ─── Paleta dinámica para categorías ─────────────────────
const CAT_PALETTE = ['#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444', '#14B8A6', '#F59E0B'];
function catColorFor(_cat: string, index: number) {
  return CAT_PALETTE[index % CAT_PALETTE.length];
}

// ─── Helper: formatea mes YYYY-MM → "Ene 25" ─────────────
function monthLabel(mes: string): string {
  const [y, m] = mes.split('-');
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${names[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// ─── Datos mock (fallback cuando Supabase no está listo) ──
const produccionData = [
  { producto: 'Artisan Sourdough', PV: 1800, 'La Reina': 1100, PT: 850, Bilbao: 450, total: 4200 },
  { producto: 'Almond Croissant',  PV: 1500, 'La Reina': 1200, PT: 700, Bilbao: 400, total: 3800 },
  { producto: 'Flat White (Bean)', PV: 1200, 'La Reina': 900,  PT: 700, Bilbao: 300, total: 3100 },
  { producto: 'Rye Bread',         PV: 600,  'La Reina': 400,  PT: 1300, Bilbao: 600, total: 2900 },
  { producto: 'Marraqueta Clásica',PV: 900,  'La Reina': 700,  PT: 600, Bilbao: 400, total: 2600 },
];
const COLORS_SUC: Record<string, string> = { PV: '#3B82F6', 'La Reina': '#8B5CF6', PT: '#10B981', Bilbao: '#F97316' };

const categoriaDonut = [
  { name: 'Bread',  value: 54, color: '#3B82F6' },
  { name: 'Pastry', value: 28, color: '#8B5CF6' },
  { name: 'Coffee', value: 18, color: '#10B981' },
];

const prodFinData = {
  '7D': [
    { fecha: 'Lun', ventas: 2100000, costos: 820000 },
    { fecha: 'Mar', ventas: 1800000, costos: 710000 },
    { fecha: 'Mié', ventas: 2400000, costos: 940000 },
    { fecha: 'Jue', ventas: 3200000, costos: 1250000 },
    { fecha: 'Vie', ventas: 2900000, costos: 1130000 },
    { fecha: 'Sáb', ventas: 4100000, costos: 1600000 },
    { fecha: 'Dom', ventas: 2800000, costos: 1090000 },
  ],
  '14D': [
    { fecha: 'Jun 17', ventas: 1900000, costos: 740000 },
    { fecha: 'Jun 18', ventas: 2100000, costos: 820000 },
    { fecha: 'Jun 19', ventas: 1800000, costos: 700000 },
    { fecha: 'Jun 20', ventas: 2600000, costos: 1010000 },
    { fecha: 'Jun 21', ventas: 2300000, costos: 900000 },
    { fecha: 'Jun 22', ventas: 3800000, costos: 1480000 },
    { fecha: 'Jun 23', ventas: 2900000, costos: 1130000 },
    { fecha: 'Jun 24', ventas: 2100000, costos: 820000 },
    { fecha: 'Jun 25', ventas: 1900000, costos: 740000 },
    { fecha: 'Jun 26', ventas: 2500000, costos: 980000 },
    { fecha: 'Jun 27', ventas: 3300000, costos: 1290000 },
    { fecha: 'Jun 28', ventas: 2900000, costos: 1130000 },
    { fecha: 'Jun 29', ventas: 4100000, costos: 1600000 },
    { fecha: 'Jun 30', ventas: 2800000, costos: 1090000 },
  ],
  '30D': [
    { fecha: 'Jun 01', ventas: 1500000, costos: 580000 },
    { fecha: 'Jun 04', ventas: 1800000, costos: 700000 },
    { fecha: 'Jun 07', ventas: 1600000, costos: 625000 },
    { fecha: 'Jun 10', ventas: 2100000, costos: 820000 },
    { fecha: 'Jun 13', ventas: 1900000, costos: 740000 },
    { fecha: 'Jun 16', ventas: 1400000, costos: 550000 },
    { fecha: 'Jun 19', ventas: 2800000, costos: 1090000 },
    { fecha: 'Jun 22', ventas: 3500000, costos: 1360000 },
    { fecha: 'Jun 25', ventas: 2900000, costos: 1130000 },
    { fecha: 'Jun 28', ventas: 2300000, costos: 900000 },
    { fecha: 'Jun 30', ventas: 2800000, costos: 1090000 },
  ],
};

const costosCategoria = [
  { categoria: 'Bread',  ingreso: 18500000, costo: 7030000,  margen: 62, unidades: 0 },
  { categoria: 'Pastry', ingreso: 12100000, costo: 6280000,  margen: 48, unidades: 0 },
  { categoria: 'Coffee', ingreso: 7800000,  costo: 2030000,  margen: 74, unidades: 0 },
];

const MOCK_PRODUCTOS = [
  { id: 1, nombre: 'Artisan Sourdough',  sku: 'B-001', cat: 'Bakery',  emoji: '🍞', unidades: 4280, ingresos: 14980000, margen: 62.5, sparkTrend: 'up' },
  { id: 2, nombre: 'Almond Croissant',   sku: 'P-042', cat: 'Pastry',  emoji: '🥐', unidades: 3850, ingresos: 12450000, margen: 48.2, sparkTrend: 'up' },
  { id: 3, nombre: 'Flat White (Bean)',  sku: 'C-112', cat: 'Coffee',  emoji: '☕', unidades: 3120, ingresos: 9360000,  margen: 74.1, sparkTrend: 'up' },
  { id: 4, nombre: 'Rye Bread',          sku: 'B-005', cat: 'Bakery',  emoji: '🍞', unidades: 2900, ingresos: 8700000,  margen: 38.5, sparkTrend: 'down' },
  { id: 5, nombre: 'Marraqueta Clásica', sku: 'B-012', cat: 'Bakery',  emoji: '🥖', unidades: 2600, ingresos: 7280000,  margen: 55.0, sparkTrend: 'up' },
  { id: 6, nombre: 'Latte Macchiato',    sku: 'C-033', cat: 'Coffee',  emoji: '☕', unidades: 2100, ingresos: 6300000,  margen: 71.3, sparkTrend: 'up' },
  { id: 7, nombre: 'Tarta de Queso',     sku: 'P-088', cat: 'Pastry',  emoji: '🍰', unidades: 1950, ingresos: 9750000,  margen: 42.1, sparkTrend: 'down' },
  { id: 8, nombre: 'Pan de Molde',       sku: 'B-021', cat: 'Bakery',  emoji: '🍞', unidades: 1800, ingresos: 5400000,  margen: 59.8, sparkTrend: 'up' },
];

const SPARK_UP   = [2, 3, 2, 4, 3, 5, 6];
const SPARK_DOWN = [6, 5, 4, 5, 3, 2, 2];

const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`;

// ─── Tipos Supabase ───────────────────────────────────────
type SupabaseProducto = {
  nombre: string; categoria: string; unidades: number; ingresos: number;
  porSucursal: Record<string, number>;
};
type SupabaseCategoria = { categoria: string; unidades: number; ingresos: number };
type SupabaseAnalytics = {
  ok: boolean; configured: boolean; error?: string;
  kpi?: { totalVentas: number; totalPedidos: number; totalUnidades: number; topCategoria: string | null; topProducto: string | null };
  porMes?: { mes: string; ventas: number; pedidos: number }[];
  porSucursal?: Record<string, { ventas: number; pedidos: number }>;
  topProductos?: SupabaseProducto[];
  porCategoria?: SupabaseCategoria[];
  areas?: string[];
};

type Periodo = '7D' | '14D' | '30D';
type TipoGrafico = 'area' | 'linea' | 'barras';

// ─── Mini sparkline ───────────────────────────────────────
function Sparkline({ trend }: { trend: 'up' | 'down' }) {
  const d = trend === 'up' ? SPARK_UP : SPARK_DOWN;
  const color = trend === 'up' ? '#22C55E' : '#EF4444';
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={d.map((v, i) => ({ v, i }))} barSize={6}>
          <Bar dataKey="v" radius={[2, 2, 0, 0]}>
            {d.map((_, i) => (
              <Cell key={i} fill={i === d.length - 1 ? color : trend === 'up' ? '#BBFFD8' : '#FEC9C9'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Gráfico temporal (ventas por período o mensual) ──────
function VentasChart({
  data, tipo, showCostos = true,
}: {
  data: { fecha: string; ventas: number; costos?: number }[];
  tipo: TipoGrafico;
  showCostos?: boolean;
}) {
  const yFmt = (v: number) => fmt(v);
  const shared = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={yFmt} width={52} />
      <Tooltip
        formatter={(v: unknown, name: unknown) => [fmt(Number(v)), String(name)]}
        contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
      />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
        formatter={(v) => <span style={{ color: '#6B7280' }}>{v}</span>} />
    </>
  );

  if (tipo === 'area') return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gV2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.12} /><stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        {shared}
        <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gV2)" dot={false} activeDot={{ r: 4 }} />
        {showCostos && <Area type="monotone" dataKey="costos" name="Costos" stroke="#F97316" strokeWidth={2} fill="url(#gC2)" dot={false} activeDot={{ r: 4 }} />}
      </AreaChart>
    </ResponsiveContainer>
  );
  if (tipo === 'linea') return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        {shared}
        <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
        {showCostos && <Line type="monotone" dataKey="costos" name="Costos" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />}
      </LineChart>
    </ResponsiveContainer>
  );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%" barGap={3}>
        {shared}
        <Bar dataKey="ventas" name="Ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        {showCostos && <Bar dataKey="costos" name="Costos" fill="#F97316" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Página principal ─────────────────────────────────────
const PAGE_SIZE = 8;

export default function ProductosPage() {
  const [page, setPage] = useState(1);
  const [periodo, setPeriodo] = useState<Periodo>('30D'); // solo para mock
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('area');
  const [filtroCat, setFiltroCat] = useState('Todas');
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'dia'>('mes');

  // Defaults
  const _hoy = new Date();
  const _defMesHasta = `${_hoy.getFullYear()}-${String(_hoy.getMonth() + 1).padStart(2, '0')}`;
  const _d2 = new Date(_hoy.getFullYear(), _hoy.getMonth() - 2, 1);
  const _defMesDesde = `${_d2.getFullYear()}-${String(_d2.getMonth() + 1).padStart(2, '0')}`;
  const _defFechaHasta = _hoy.toISOString().slice(0, 10);
  const _d3 = new Date(_hoy); _d3.setDate(_d3.getDate() - 30);
  const _defFechaDesde = _d3.toISOString().slice(0, 10);

  const [mesDesde,   setMesDesde]   = useState(_defMesDesde);
  const [mesHasta,   setMesHasta]   = useState(_defMesHasta);
  const [fechaDesde, setFechaDesde] = useState(_defFechaDesde);
  const [fechaHasta, setFechaHasta] = useState(_defFechaHasta);

  // ── Datos Supabase ────────────────────────────────────────
  const [sbData, setSbData] = useState<SupabaseAnalytics | null>(null);
  const [loadingSb, setLoadingSb] = useState(true);

  useEffect(() => {
    setLoadingSb(true);
    const params = new URLSearchParams();
    if (modoFiltro === 'dia') {
      params.set('fechaDesde', fechaDesde);
      params.set('fechaHasta', fechaHasta);
    } else {
      params.set('mesDesde', mesDesde);
      params.set('mesHasta', mesHasta);
    }
    fetch(`/api/supabase-analytics?${params}`)
      .then(r => r.json())
      .then((d: SupabaseAnalytics) => setSbData(d))
      .catch(() => setSbData(null))
      .finally(() => setLoadingSb(false));
  }, [modoFiltro, mesDesde, mesHasta, fechaDesde, fechaHasta]);

  const usingReal = sbData?.ok === true && (sbData.topProductos?.length ?? 0) > 0;

  // ── Productos ─────────────────────────────────────────────
  const allProductos = useMemo(() => {
    if (!usingReal) return MOCK_PRODUCTOS;
    return (sbData!.topProductos ?? []).map((p, i) => ({
      id: i + 1,
      nombre: p.nombre,
      sku: `#${String(i + 1).padStart(3, '0')}`,
      cat: p.categoria,
      emoji: '📦',
      unidades: p.unidades,
      ingresos: p.ingresos,
      margen: 0,
      sparkTrend: 'up' as const,
    }));
  }, [usingReal, sbData]);

  const categoriasDisp = useMemo(() => {
    if (!usingReal) return ['Bakery', 'Pastry', 'Coffee'];
    return [...new Set(allProductos.map(p => p.cat))];
  }, [usingReal, allProductos]);

  // ── Donut de categorías ────────────────────────────────────
  const categoriaDonutData = useMemo(() => {
    if (!usingReal) return categoriaDonut;
    const cats = sbData!.porCategoria ?? [];
    const totalIngresos = cats.reduce((s, c) => s + c.ingresos, 0) || 1;
    return cats.slice(0, 6).map((c, i) => ({
      name: c.categoria,
      value: Math.round((c.ingresos / totalIngresos) * 100),
      color: catColorFor(c.categoria, i),
    }));
  }, [usingReal, sbData]);

  // ── Top productos (barras horizontales) ───────────────────
  const topProductosBar = useMemo(() => {
    if (!usingReal) return produccionData;
    return (sbData!.topProductos ?? []).slice(0, 5).map(p => ({
      producto: p.nombre,
      total: p.unidades,
      categoria: p.categoria,
    }));
  }, [usingReal, sbData]);

  const coloresSucursal = useMemo(() => {
    if (!usingReal) return COLORS_SUC;
    const sucursales = Object.keys(sbData?.porSucursal ?? {});
    const result: Record<string, string> = {};
    sucursales.forEach((s, i) => { result[s] = CAT_PALETTE[i % CAT_PALETTE.length]; });
    return result;
  }, [usingReal, sbData]);

  // ── Gráfico mensual (Supabase) ────────────────────────────
  const chartDataReal = useMemo(() => {
    if (!usingReal || !(sbData?.porMes?.length)) return null;
    return sbData!.porMes.map(m => ({
      fecha: monthLabel(m.mes),
      ventas: m.ventas,
      pedidos: m.pedidos,
    }));
  }, [usingReal, sbData]);

  const chartData = chartDataReal ?? prodFinData[periodo];

  // ── KPIs sección ventas/producción ───────────────────────
  const prodKpis = useMemo(() => {
    if (!usingReal || !sbData?.kpi) return [
      { label: 'Ingresos Totales',  value: '$38.4M', delta: '+11%', pos: true,  color: 'text-blue-600',   bg: 'bg-blue-50' },
      { label: 'Costos Totales',    value: '$15.1M', delta: '+4%',  pos: false, color: 'text-orange-500', bg: 'bg-orange-50' },
      { label: 'Margen Bruto',      value: '60.7%',  delta: '+3.2pp', pos: true, color: 'text-green-600', bg: 'bg-green-50' },
      { label: 'Costo / Unidad',    value: '$334',   delta: '-2.1%', pos: true,  color: 'text-purple-600', bg: 'bg-purple-50' },
    ];
    const kpi = sbData.kpi;
    return [
      { label: 'Ventas Totales',   value: fmt(kpi.totalVentas),                    delta: '12 meses', pos: true,  color: 'text-blue-600',   bg: 'bg-blue-50' },
      { label: 'Total Pedidos',    value: kpi.totalPedidos.toLocaleString('es-CL'), delta: 'ConectOca', pos: true, color: 'text-purple-600', bg: 'bg-purple-50' },
      { label: 'Unidades Vendidas',value: kpi.totalUnidades.toLocaleString('es-CL'),delta: 'pedidos',  pos: true,  color: 'text-green-600',  bg: 'bg-green-50' },
      { label: 'Área Estrella',    value: kpi.topCategoria ?? '—',                  delta: 'top área', pos: true,  color: 'text-orange-500', bg: 'bg-orange-50' },
    ];
  }, [usingReal, sbData]);

  // ── Desglose por categoría ────────────────────────────────
  const costosDesglose = useMemo(() => {
    if (!usingReal) return costosCategoria;
    return (sbData?.porCategoria ?? []).slice(0, 6).map(c => ({
      categoria: c.categoria,
      ingreso: c.ingresos,
      costo: 0,
      margen: 0,
      unidades: c.unidades,
    }));
  }, [usingReal, sbData]);

  // ── KPIs superiores ───────────────────────────────────────
  const kpiFmt = {
    totalUnidades: usingReal
      ? (sbData!.kpi!.totalUnidades).toLocaleString('es-CL')
      : allProductos.reduce((s, p) => s + p.unidades, 0).toLocaleString('es-CL'),
    topCategoria: usingReal ? (sbData!.kpi?.topCategoria ?? '—') : 'Bakery',
    topProducto:  usingReal ? (sbData!.kpi?.topProducto  ?? allProductos[0]?.nombre) : allProductos[0]?.nombre,
    totalPedidos: usingReal ? sbData!.kpi!.totalPedidos : null,
  };

  const productosFiltrados = filtroCat === 'Todas' ? allProductos : allProductos.filter(p => p.cat === filtroCat);
  const totalPages = Math.ceil(productosFiltrados.length / PAGE_SIZE) || 1;
  const productosPag = productosFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportChart = () => {
    exportToCSV(
      chartData.map(d => ({ Fecha: d.fecha, Ventas: d.ventas, ...('costos' in d ? { Costos: d.costos } : {}) })),
      'ventas_mensual'
    );
    toast('Datos exportados');
  };

  const handleExportProductos = () => {
    exportToCSV(
      productosFiltrados.map(p => ({
        Producto: p.nombre, SKU: p.sku, Categoría: p.cat,
        'Unidades Vendidas': p.unidades, 'Ingresos CLP': p.ingresos,
        ...(!usingReal ? { 'Margen %': p.margen } : {}),
      })),
      'productos_rendimiento'
    );
    toast('Tabla de productos exportada');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input type="text" placeholder="Buscar productos, SKUs..." className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400" />
        </div>

        {/* Filtro de fecha */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => { setModoFiltro('mes'); setPage(1); }}
              className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap',
                modoFiltro === 'mes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              Por mes
            </button>
            <button
              onClick={() => { setModoFiltro('dia'); setPage(1); }}
              className={clsx('flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap',
                modoFiltro === 'dia' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <Calendar className="w-3 h-3" />Por fecha
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {modoFiltro === 'mes' ? (
              <>
                <input type="month" value={mesDesde} max={mesHasta}
                  onChange={e => { setMesDesde(e.target.value); setPage(1); }}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600" />
                <span className="text-gray-300 text-[11px]">→</span>
                <input type="month" value={mesHasta} min={mesDesde}
                  onChange={e => { setMesHasta(e.target.value); setPage(1); }}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600" />
              </>
            ) : (
              <>
                <input type="date" value={fechaDesde} max={fechaHasta}
                  onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600" />
                <span className="text-gray-300 text-[11px]">→</span>
                <input type="date" value={fechaHasta} min={fechaDesde}
                  onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 bg-white text-[11px] font-medium text-gray-600" />
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {usingReal && (
            <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 whitespace-nowrap">
              ConectOca · en vivo
            </span>
          )}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 space-y-5 pb-8">

        {/* ── Título ── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-black text-gray-900">Análisis de Productos</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {usingReal
                ? `ConectOca · ${modoFiltro === 'mes' ? `${mesDesde} → ${mesHasta}` : `${fechaDesde} → ${fechaHasta}`} — pedidos, productos y áreas de producción.`
                : 'Rendimiento detallado de inventario y ventas por categoría.'}
            </p>
          </div>
          {loadingSb && (
            <span className="text-[11px] text-gray-400 animate-pulse pb-0.5">Cargando datos...</span>
          )}
        </div>

        {/* ── KPIs superiores ── */}
        <div className={clsx('grid gap-4', kpiFmt.totalPedidos !== null ? 'grid-cols-4' : 'grid-cols-3')}>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Unidades Vendidas</p>
            <div className="flex items-end gap-3">
              <p className="text-[32px] font-black text-gray-900 leading-none">
                {loadingSb ? '...' : kpiFmt.totalUnidades}
              </p>
              {!usingReal && <span className="text-[12px] font-bold text-green-600 flex items-center gap-0.5 pb-1"><TrendingUp className="w-3.5 h-3.5" />+12.5%</span>}
            </div>
            {usingReal && <p className="text-[10px] text-blue-500 font-medium mt-1">Datos reales · ConectOca</p>}
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Área Estrella</p>
            <div className="flex items-center justify-between">
              <p className="text-[24px] font-black text-gray-900 leading-tight truncate">{loadingSb ? '...' : kpiFmt.topCategoria}</p>
              <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0 ml-2">
                <Star className="w-5 h-5 text-blue-500 fill-blue-500" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Producto más Vendido</p>
            <p className="text-[18px] font-black text-gray-900 leading-tight truncate">{loadingSb ? '...' : kpiFmt.topProducto}</p>
          </div>
          {kpiFmt.totalPedidos !== null && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Total Pedidos</p>
              <p className="text-[32px] font-black text-gray-900 leading-none">
                {kpiFmt.totalPedidos.toLocaleString('es-CL')}
              </p>
              <p className="text-[10px] text-blue-500 font-medium mt-1">Últimos 12 meses</p>
            </div>
          )}
        </div>

        {/* ── Top Productos + Donut ── */}
        <div className="grid grid-cols-3 gap-5">

          {/* Top productos por unidades */}
          <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Top Productos</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {usingReal
                    ? `Por unidades vendidas · ${modoFiltro === 'mes' ? `${mesDesde} → ${mesHasta}` : `${fechaDesde} → ${fechaHasta}`}`
                    : 'Producción por sucursal · últimos 30 días'}
                </p>
              </div>
              {!usingReal && (
                <div className="flex items-center gap-3 text-[10px]">
                  {Object.entries(COLORS_SUC).map(([s, c]) => (
                    <span key={s} className="flex items-center gap-1 text-gray-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c }} />
                      {s.toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {loadingSb ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-gray-100 rounded mb-1.5 w-1/3" />
                    <div className="h-3 bg-gray-100 rounded-full w-full" />
                  </div>
                ))}
              </div>
            ) : usingReal ? (
              /* Barras simples por producto (sin sucursal) */
              <div className="space-y-4">
                {(() => {
                  const maxU = Math.max(...topProductosBar.map(r => r.total), 1);
                  return topProductosBar.map((row, idx) => (
                    <div key={row.producto}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: catColorFor(('categoria' in row ? row.categoria as string : ''), idx) }} />
                          <span className="text-[12px] font-semibold text-gray-700 truncate">{row.producto}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                          {row.total >= 1000 ? `${(row.total / 1000).toFixed(1)}k` : row.total} u.
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(row.total / maxU) * 100}%`,
                            backgroundColor: catColorFor(('categoria' in row ? row.categoria as string : ''), idx),
                          }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              /* Stacked bars mock (sucursales) */
              <div className="space-y-4">
                {produccionData.map((row) => {
                  const sucursales = Object.keys(coloresSucursal);
                  const total = row.total || 1;
                  return (
                    <div key={row.producto}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-semibold text-gray-700 truncate">{row.producto}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total} u.
                        </span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden w-full">
                        {sucursales.map(suc => {
                          const val = (row as Record<string, unknown>)[suc] as number ?? 0;
                          const pct = (val / total) * 100;
                          return (
                            <div key={suc} className="h-full transition-all duration-700"
                              style={{ width: `${pct}%`, backgroundColor: coloresSucursal[suc] }}
                              title={`${suc}: ${val}`} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Donut: por área/categoría */}
          <div className="col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">
              {usingReal ? 'Por Área de Producción' : 'Ventas por Categoría'}
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">Participación sobre el total</p>

            {loadingSb ? (
              <div className="w-44 h-44 mx-auto rounded-full bg-gray-100 animate-pulse" />
            ) : (
              <>
                <div className="relative w-44 h-44 mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoriaDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={72}
                        dataKey="value" startAngle={90} endAngle={-270} strokeWidth={3} stroke="#fff">
                        {categoriaDonutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v}%`, '']} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[22px] font-black text-gray-900 leading-none">100%</p>
                    <p className="text-[9px] text-gray-400 tracking-widest uppercase mt-0.5">GLOBAL</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {categoriaDonutData.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-[12px] text-gray-600 truncate">{c.name}</span>
                      </div>
                      <span className="text-[12px] font-bold text-gray-800">{c.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECCIÓN: VENTAS Y PRODUCCIÓN
        ══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {/* Cabecera */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">
                {usingReal ? 'Ventas Mensuales — ConectOca' : 'Ventas & Costos de Producción'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {usingReal
                  ? `Total facturado por mes · ${modoFiltro === 'mes' ? `${mesDesde} → ${mesHasta}` : `${fechaDesde} → ${fechaHasta}`}`
                  : 'Margen por período — Ventas vs Costos operacionales'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Período — solo cuando no hay datos reales */}
              {!usingReal && (
                <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                  {(['7D', '14D', '30D'] as Periodo[]).map(p => (
                    <button key={p} onClick={() => setPeriodo(p)}
                      className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        periodo === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {/* Tipo gráfico */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {([['area', Activity], ['linea', TrendingUp], ['barras', LayoutGrid]] as [TipoGrafico, React.ElementType][]).map(([t, Icon]) => (
                  <button key={t} onClick={() => setTipoGrafico(t)}
                    className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === t ? 'bg-white shadow-sm' : 'hover:bg-white/60')}>
                    <Icon className={clsx('w-3.5 h-3.5', tipoGrafico === t ? 'text-blue-600' : 'text-gray-400')} />
                  </button>
                ))}
              </div>
              <button onClick={handleExportChart} className="flex items-center gap-1.5 border border-blue-200 text-blue-600 rounded-lg px-3 py-1.5 text-[11px] font-semibold hover:bg-blue-50 transition-colors">
                <Download className="w-3.5 h-3.5" />Exportar
              </button>
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {prodKpis.map(k => (
              <div key={k.label} className={clsx('rounded-xl p-3.5', k.bg)}>
                <p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase mb-1.5">{k.label}</p>
                <p className={clsx('text-[20px] font-black leading-none truncate', k.color)}>{loadingSb ? '...' : k.value}</p>
                <p className={clsx('text-[10px] font-bold mt-1', k.pos ? 'text-green-600' : 'text-red-500')}>
                  {k.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          {loadingSb ? (
            <div className="h-[220px] bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <VentasChart data={chartData} tipo={tipoGrafico} showCostos={!usingReal} />
          )}

          {/* Desglose por categoría/área */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">
              {usingReal ? 'Desglose por Área de Producción' : 'Desglose por Categoría'}
            </p>
            {loadingSb ? (
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className={clsx('grid gap-3', costosDesglose.length <= 3 ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4')}>
                {costosDesglose.map((c, idx) => {
                  const color = usingReal ? catColorFor(c.categoria, idx) : '#3B82F6';
                  const pctCosto = c.costo && c.ingreso ? Math.round((c.costo / c.ingreso) * 100) : 0;
                  return (
                    <div key={c.categoria} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold truncate" style={{ color }}>{c.categoria}</span>
                        {!usingReal && c.margen > 0 && (
                          <span className="text-[11px] font-bold text-green-600 flex-shrink-0 ml-1">{c.margen}% mg</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                            <span>Ventas</span><span>{fmt(c.ingreso)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: '100%', backgroundColor: color }} />
                          </div>
                        </div>
                        {usingReal ? (
                          <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>Unidades</span><span>{('unidades' in c ? c.unidades : 0).toLocaleString('es-CL')}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-gray-300" style={{ width: '100%' }} />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                              <span>Costos</span><span>{fmt(c.costo)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${pctCosto}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabla Rendimiento por Producto ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 pb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-bold text-gray-900">Rendimiento por Producto</h3>
            <button onClick={handleExportProductos} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
              <Download className="w-3 h-3" />Exportar CSV
            </button>
          </div>

          {/* Filtros de categoría */}
          <div className="flex items-center flex-wrap bg-gray-100 rounded-xl p-1 gap-1 mb-4">
            {['Todas', ...categoriasDisp].map(cat => (
              <button key={cat} onClick={() => { setFiltroCat(cat); setPage(1); }}
                className={clsx('px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all',
                  filtroCat === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {cat}
              </button>
            ))}
          </div>

          {/* Table head */}
          <div className={clsx('grid gap-3 pb-3 border-b border-gray-100', usingReal ? 'grid-cols-5' : 'grid-cols-6')}>
            {['Producto', 'Categoría', 'Unidades', 'Tendencia', 'Ingresos', ...(usingReal ? [] : ['Margen %'])].map(c => (
              <p key={c} className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">{c}</p>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {loadingSb ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-3 py-3.5 animate-pulse">
                  {[1,2,3,4,5].map(j => <div key={j} className="h-4 bg-gray-100 rounded" />)}
                </div>
              ))
            ) : productosPag.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Package className="w-10 h-10 mb-3" />
                <p className="text-[13px] font-semibold text-gray-400">Sin productos para el período</p>
                <p className="text-[11px] text-gray-300 mt-1">Probá seleccionando un período más largo</p>
              </div>
            ) : productosPag.map(p => {
              const catIdx = categoriasDisp.indexOf(p.cat);
              const color = catColorFor(p.cat, catIdx >= 0 ? catIdx : 0);
              return (
                <div key={p.id} className={clsx('grid gap-3 py-3.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors', usingReal ? 'grid-cols-5' : 'grid-cols-6')}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-gray-100">
                      {p.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate">{p.nombre}</p>
                      <p className="text-[10px] text-gray-400">SKU: {p.sku}</p>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold truncate" style={{ color }}>{p.cat}</span>
                  <p className="text-[13px] font-semibold text-gray-700">{p.unidades.toLocaleString('es-CL')}</p>
                  <Sparkline trend={p.sparkTrend as 'up' | 'down'} />
                  <p className="text-[13px] font-bold text-gray-800">{p.ingresos > 0 ? fmt(p.ingresos) : '—'}</p>
                  {!usingReal && (
                    <p className={clsx('text-[13px] font-bold', p.margen >= 50 ? 'text-green-600' : p.margen >= 35 ? 'text-orange-500' : 'text-red-500')}>
                      {p.margen}%
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
            <p className="text-[12px] text-gray-400">
              Mostrando {productosFiltrados.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, productosFiltrados.length)} de {productosFiltrados.length} productos
              {usingReal && <span className="ml-1 text-blue-500">· ConectOca</span>}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={clsx('w-7 h-7 rounded-lg text-[12px] font-semibold transition-all',
                    page === n ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {n}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-300 pb-2">
          © 2025 FinanzasOca · {usingReal ? 'Datos en vivo desde ConectOca' : 'Dashboard de análisis avanzado'}
        </p>
      </main>
    </div>
  );
}
