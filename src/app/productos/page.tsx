'use client';

import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, LineChart, Line,
} from 'recharts';
import {
  Search, Bell, Calendar, MapPin, ChevronDown,
  ChevronLeft, ChevronRight, Download, Star,
  TrendingUp, TrendingDown, Activity, LayoutGrid,
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';

// ─── Colores por sucursal ────────────────────────────────
const COLORS_SUC = { PV: '#3B82F6', 'La Reina': '#8B5CF6', PT: '#10B981', Bilbao: '#F97316' };

// ─── Producción por sucursal (stacked bars) ──────────────
const produccionData = [
  { producto: 'Artisan Sourdough', PV: 1800, 'La Reina': 1100, PT: 850, Bilbao: 450, total: 4200 },
  { producto: 'Almond Croissant',  PV: 1500, 'La Reina': 1200, PT: 700, Bilbao: 400, total: 3800 },
  { producto: 'Flat White (Bean)', PV: 1200, 'La Reina': 900,  PT: 700, Bilbao: 300, total: 3100 },
  { producto: 'Rye Bread',         PV: 600,  'La Reina': 400,  PT: 1300, Bilbao: 600, total: 2900 },
  { producto: 'Marraqueta Clásica',PV: 900,  'La Reina': 700,  PT: 600, Bilbao: 400, total: 2600 },
];

// ─── Ventas por categoría (donut) ────────────────────────
const categoriaDonut = [
  { name: 'Bread',  value: 54, color: '#3B82F6' },
  { name: 'Pastry', value: 28, color: '#8B5CF6' },
  { name: 'Coffee', value: 18, color: '#10B981' },
];

// ─── Datos ventas/gastos de producción por período ───────
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

// ─── Breakdown costos por categoría ─────────────────────
const costosCategoria = [
  { categoria: 'Bread',  ingreso: 18500000, costo: 7030000,  margen: 62 },
  { categoria: 'Pastry', ingreso: 12100000, costo: 6280000,  margen: 48 },
  { categoria: 'Coffee', ingreso: 7800000,  costo: 2030000,  margen: 74 },
];

// ─── Tabla de productos ───────────────────────────────────
const allProductos = [
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

const catColor: Record<string, string> = {
  Bakery: 'text-blue-600', Pastry: 'text-purple-600', Coffee: 'text-emerald-600',
};
const catBg: Record<string, string> = {
  Bakery: 'bg-blue-50', Pastry: 'bg-purple-50', Coffee: 'bg-emerald-50',
};

const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`;

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
              <Cell key={i}
                fill={i === d.length - 1 ? color : trend === 'up' ? '#BBFFD8' : '#FEC9C9'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Gráfico de producción financiera ────────────────────
function ProdFinChart({ data, tipo }: { data: typeof prodFinData['7D']; tipo: TipoGrafico }) {
  const yFmt = (v: number) => fmt(v);
  const shared = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={yFmt} width={52} />
      <Tooltip
        formatter={(v: any, name: any) => [fmt(Number(v)), String(name)]}
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
        <Area type="monotone" dataKey="costos" name="Costos Producción" stroke="#F97316" strokeWidth={2} fill="url(#gC2)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
  if (tipo === 'linea') return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        {shared}
        <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="costos" name="Costos Producción" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: '#F97316', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="30%" barGap={3}>
        {shared}
        <Bar dataKey="ventas" name="Ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="costos" name="Costos Producción" fill="#F97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Página principal ─────────────────────────────────────
const PAGE_SIZE = 4;

export default function ProductosPage() {
  const [sucursal, setSucursal] = useState('Todas las Sucursales');
  const [sucursalOpen, setSucursalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [periodo, setPeriodo] = useState<Periodo>('30D');
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('area');
  const [filtroCat, setFiltroCat] = useState('Todas');

  const totalPages = 3;
  const productosPag = allProductos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartData = prodFinData[periodo];

  const totalUnidades = allProductos.reduce((s, p) => s + p.unidades, 0).toLocaleString('es-CL');
  const topProducto = allProductos[0];

  const productosFiltrados = filtroCat === 'Todas' ? allProductos : allProductos.filter(p => p.cat === filtroCat);

  const handleExportChart = () => {
    exportToCSV(chartData.map(d => ({ Fecha: d.fecha, Ventas: d.ventas, 'Costos Producción': d.costos })), 'produccion_financiera');
    toast('Datos de producción exportados');
  };

  const handleExportProductos = () => {
    exportToCSV(
      productosFiltrados.map(p => ({
        Producto: p.nombre,
        SKU: p.sku,
        Categoría: p.cat,
        'Unidades Vendidas': p.unidades,
        'Ingresos CLP': p.ingresos,
        'Margen %': p.margen,
        Tendencia: p.sparkTrend,
      })),
      'productos_rendimiento'
    );
    toast('Tabla de productos exportada');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input type="text" placeholder="Buscar productos, SKUs..." className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400" />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Últimos 30 días</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          <div className="relative">
            <button onClick={() => setSucursalOpen(!sucursalOpen)}
              className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>{sucursal}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {sucursalOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px]">
                {['Todas las Sucursales', 'PV', 'La Reina', 'PT', 'Bilbao'].map(s => (
                  <button key={s} onClick={() => { setSucursal(s); setSucursalOpen(false); }}
                    className={clsx('w-full text-left px-4 py-2.5 text-[12px] hover:bg-blue-50 transition-colors',
                      sucursal === s ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700')}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 space-y-5 pb-8">

        {/* ── Título ── */}
        <div>
          <h1 className="text-[22px] font-black text-gray-900">Análisis de Productos</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Rendimiento detallado de inventario y ventas por categoría.</p>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Unidades Totales Vendidas</p>
            <div className="flex items-end gap-3">
              <p className="text-[32px] font-black text-gray-900 leading-none">{totalUnidades}</p>
              <span className="text-[12px] font-bold text-green-600 flex items-center gap-0.5 pb-1">
                <TrendingUp className="w-3.5 h-3.5" />+12.5%
              </span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Categoría Estrella</p>
            <div className="flex items-center justify-between">
              <p className="text-[32px] font-black text-gray-900">Bakery</p>
              <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-blue-500 fill-blue-500" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-3">Producto más Vendido</p>
            <div className="flex items-end justify-between">
              <p className="text-[24px] font-black text-gray-900 leading-tight">{topProducto.nombre}</p>
              <span className="text-[12px] font-bold text-green-600 flex items-center gap-0.5 pb-1 flex-shrink-0 ml-2">
                <TrendingUp className="w-3.5 h-3.5" />+8.2%
              </span>
            </div>
          </div>
        </div>

        {/* ── Producción + Donut ── */}
        <div className="grid grid-cols-3 gap-5">

          {/* Stacked bar: Producción por Sucursal */}
          <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Producción por Sucursal</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Top 5 productos más demandados</p>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                {Object.entries(COLORS_SUC).map(([s, c]) => (
                  <span key={s} className="flex items-center gap-1 text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: c }} />
                    {s.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {produccionData.map((row) => (
                <div key={row.producto}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-semibold text-gray-700">{row.producto}</span>
                    <span className="text-[11px] text-gray-400">Total: {(row.total / 1000).toFixed(1)}k u.</span>
                  </div>
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden w-full">
                    {Object.entries(COLORS_SUC).map(([suc, color]) => {
                      const val = row[suc as keyof typeof row] as number;
                      const pct = (val / row.total) * 100;
                      return (
                        <div key={suc} className="h-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} title={`${suc}: ${val}`} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Donut: Ventas por Categoría */}
          <div className="col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">Ventas por Categoría</h3>
            <p className="text-[11px] text-gray-400 mb-4">Participación sobre el total</p>

            <div className="relative w-44 h-44 mx-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriaDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={72}
                    dataKey="value" startAngle={90} endAngle={-270} strokeWidth={3} stroke="#fff">
                    {categoriaDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
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
              {categoriaDonut.map(c => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-[12px] text-gray-600">{c.name}</span>
                  </div>
                  <span className="text-[12px] font-bold text-gray-800">{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            SECCIÓN: VENTAS Y GASTOS DE PRODUCCIÓN
        ══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          {/* Cabecera */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-gray-900">Ventas & Costos de Producción</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Margen por período — Ventas vs Costos operacionales</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Período */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {(['7D', '14D', '30D'] as Periodo[]).map(p => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                      periodo === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {p}
                  </button>
                ))}
              </div>
              {/* Tipo gráfico */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {([['area', Activity], ['linea', TrendingUp], ['barras', LayoutGrid]] as [TipoGrafico, any][]).map(([t, Icon]) => (
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

          {/* KPIs de producción */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Ingresos Totales', value: '$38.4M', delta: '+11%', pos: true, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Costos Totales', value: '$15.1M', delta: '+4%', pos: false, color: 'text-orange-500', bg: 'bg-orange-50' },
              { label: 'Margen Bruto', value: '60.7%', delta: '+3.2pp', pos: true, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Costo / Unidad', value: '$334', delta: '-2.1%', pos: true, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(k => (
              <div key={k.label} className={clsx('rounded-xl p-3.5', k.bg)}>
                <p className="text-[10px] font-bold tracking-wide text-gray-500 uppercase mb-1.5">{k.label}</p>
                <p className={clsx('text-[20px] font-black leading-none', k.color)}>{k.value}</p>
                <p className={clsx('text-[10px] font-bold mt-1', k.pos ? 'text-green-600' : 'text-red-500')}>
                  {k.pos ? '↑' : '↓'} {k.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Gráfico interactivo */}
          <ProdFinChart data={chartData} tipo={tipoGrafico} />

          {/* Breakdown por categoría */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3">Desglose por Categoría</p>
            <div className="grid grid-cols-3 gap-3">
              {costosCategoria.map(c => {
                const pctCosto = Math.round((c.costo / c.ingreso) * 100);
                return (
                  <div key={c.categoria} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={clsx('text-[12px] font-bold', catColor[c.categoria])}>{c.categoria}</span>
                      <span className="text-[11px] font-bold text-green-600">{c.margen}% margen</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Ventas</span><span>{fmt(c.ingreso)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: '100%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                          <span>Costos</span><span>{fmt(c.costo)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${pctCosto}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Tabla Rendimiento por Producto ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 pb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[15px] font-bold text-gray-900">Rendimiento por Producto</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {['Todas', 'Bakery', 'Pastry', 'Coffee'].map(cat => (
                  <button key={cat} onClick={() => setFiltroCat(cat)}
                    className={clsx('px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all',
                      filtroCat === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {cat}
                  </button>
                ))}
              </div>
              <button onClick={handleExportProductos} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
                <Download className="w-3 h-3" />Exportar CSV
              </button>
            </div>
          </div>

          {/* Table head */}
          <div className="grid grid-cols-6 gap-3 pb-3 border-b border-gray-100">
            {['Producto', 'Categoría', 'Unidades Vendidas', 'Tendencia (30D)', 'Ingresos', 'Margen %'].map(c => (
              <p key={c} className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">{c}</p>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {productosPag
              .filter(p => filtroCat === 'Todas' || p.cat === filtroCat)
              .map(p => (
                <div key={p.id} className="grid grid-cols-6 gap-3 py-3.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0', catBg[p.cat])}>
                      {p.emoji}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-gray-800 truncate">{p.nombre}</p>
                      <p className="text-[10px] text-gray-400">SKU: {p.sku}</p>
                    </div>
                  </div>
                  <span className={clsx('text-[12px] font-semibold', catColor[p.cat])}>{p.cat}</span>
                  <p className="text-[13px] font-semibold text-gray-700">{p.unidades.toLocaleString('es-CL')}</p>
                  <Sparkline trend={p.sparkTrend as 'up' | 'down'} />
                  <p className="text-[13px] font-bold text-gray-800">{fmt(p.ingresos)}</p>
                  <p className={clsx('text-[13px] font-bold', p.margen >= 50 ? 'text-green-600' : p.margen >= 35 ? 'text-orange-500' : 'text-red-500')}>
                    {p.margen}%
                  </p>
                </div>
              ))}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
            <p className="text-[12px] text-gray-400">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, allProductos.length)} de 128 productos
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {[1, 2, 3].map(n => (
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

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-300 pb-2">
          © 2024 Bakery OS. Dashboard de análisis avanzado para retail.
        </p>
      </main>
    </div>
  );
}
