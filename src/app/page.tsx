'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Store, CreditCard, Receipt, Building2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import DailyPerformanceChart from '@/components/dashboard/DailyPerformanceChart';
import DistributionTreemap from '@/components/dashboard/DistributionTreemap';
import type { DashboardFilters } from '@/types';
import { toast } from '@/components/ui/Toast';
import { exportToCSV } from '@/lib/csv-export';
import { getSucursalColor, sortSucursales } from '@/config/sucursales';

// ── Tipos de respuesta de APIs ────────────────────────────────────────────────
type CierreCajaResp = {
  ok: boolean;
  kpi: { totalVentas: number; totalEfectivo: number; totalTarjeta: number; totalTransf: number; totalCierres: number } | null;
  chartData: { fecha: string; ventas: number; efectivo: number; tarjeta: number; transf: number }[];
  porLocal: Record<string, { ventas: number; efectivo: number; tarjeta: number; transf: number; cierres: number }>;
  porLocalMes: Record<string, Record<string, { ventas: number; efectivo: number; tarjeta: number; transf: number }>>;
  mesesDisponibles: string[];
  medioPago: { efectivo: number; tarjeta: number; transf: number };
};

type VentasResp = {
  ok: boolean;
  kpi: { totalGastos: number; totalIngresos: number; totalTransacciones: number } | null;
  gastosPorMes: Record<string, number>;
  porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }>;
};

// ── Helpers de formato ────────────────────────────────────────────────────────
const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatCLPInt(v: number) {
  return `$${Math.round(v).toLocaleString('es-CL')}`;
}
function mesLabel(key: string) {
  const [anio, mes] = key.split('-');
  return `${MESES_FULL[mes] ?? mes} ${anio}`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, delta, deltaPositive, icon, accent = 'blue',
}: {
  label: string; value: string; sub?: string;
  delta?: string; deltaPositive?: boolean;
  icon: React.ReactNode; accent?: 'blue' | 'red' | 'green' | 'gray';
}) {
  const accentBg = { blue: 'bg-blue-50', red: 'bg-red-50', green: 'bg-green-50', gray: 'bg-gray-100' }[accent];
  const accentIcon = { blue: 'text-blue-600', red: 'text-red-500', green: 'text-green-600', gray: 'text-gray-500' }[accent];

  return (
    <div className="bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentBg}`}>
          <span className={accentIcon}>{icon}</span>
        </div>
      </div>
      <p className="text-[26px] font-bold leading-tight text-gray-900">{value}</p>
      <div className="flex items-center gap-1.5">
        {delta !== undefined && (
          deltaPositive
            ? <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        )}
        <span className={`text-[11px] ${delta !== undefined ? (deltaPositive ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold') : 'text-gray-400'}`}>
          {sub ?? ''}
        </span>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-2xl animate-pulse ${className}`} />;
}

// ── Resumen por sucursal (tabla inferior) ─────────────────────────────────────
function ResumenSucursales({
  distribucion, gastosPorSucursal, totalVentas, loading,
}: {
  distribucion: { nombre: string; valor: number; porcentaje: number; color: string }[];
  gastosPorSucursal: Record<string, { gastos: number }>;
  totalVentas: number;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-full min-h-[200px]" />;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-full">
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-gray-900">Resumen por Sucursal</h3>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Ventas · Gastos · Participación</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-100">
              <th className="text-left pb-2 font-semibold">Sucursal</th>
              <th className="text-right pb-2 font-semibold">Ventas</th>
              <th className="text-right pb-2 font-semibold">Gastos</th>
              <th className="text-right pb-2 font-semibold">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {distribucion.map((suc) => {
              const gastos = gastosPorSucursal[suc.nombre]?.gastos ?? 0;
              return (
                <tr key={suc.nombre} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: suc.color }} />
                      <span className="font-semibold text-gray-800">{suc.nombre}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900">{formatCLPInt(suc.valor)}</td>
                  <td className="py-2.5 text-right text-red-500 font-medium">{gastos > 0 ? formatCLPInt(gastos) : '—'}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <div className="h-1.5 rounded-full bg-blue-100 w-16 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${suc.porcentaje}%` }} />
                      </div>
                      <span className="text-gray-500 w-7 text-right">{suc.porcentaje}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {distribucion.length > 0 && (
            <tfoot className="border-t border-gray-200">
              <tr>
                <td className="pt-2.5 font-bold text-gray-900 text-[11px] uppercase tracking-wide">Total</td>
                <td className="pt-2.5 text-right font-bold text-gray-900">{formatCLPInt(totalVentas)}</td>
                <td className="pt-2.5 text-right font-bold text-red-500">
                  {formatCLPInt(Object.values(gastosPorSucursal).reduce((s, v) => s + v.gastos, 0))}
                </td>
                <td className="pt-2.5 text-right text-gray-400 font-semibold">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
        {distribucion.length === 0 && (
          <p className="text-center text-gray-400 text-[12px] py-8">Sin datos para el período seleccionado</p>
        )}
      </div>
    </div>
  );
}

// ── Breakdown de medios de pago ───────────────────────────────────────────────
function PaymentBreakdown({
  medioPago, totalVentas, loading,
}: {
  medioPago: { efectivo: number; tarjeta: number; transf: number };
  totalVentas: number;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-full min-h-[200px]" />;

  const items = [
    { label: 'Efectivo', pct: medioPago.efectivo, color: '#2563EB', bg: 'bg-blue-100', text: 'text-blue-700' },
    { label: 'Tarjeta', pct: medioPago.tarjeta, color: '#7C3AED', bg: 'bg-purple-100', text: 'text-purple-700' },
    { label: 'Transferencia', pct: medioPago.transf, color: '#059669', bg: 'bg-green-100', text: 'text-green-700' },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 h-full">
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-gray-900">Medio de Pago</h3>
        <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">Distribución de ventas en caja</p>
      </div>

      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-3 mb-5 gap-px">
        {items.map((item) => (
          <div key={item.label} className="transition-all duration-500" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[12px] font-medium text-gray-700">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-gray-500">{formatCLPInt(totalVentas * item.pct / 100)}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.bg} ${item.text}`}>{item.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
const defaultFilters: DashboardFilters = { fechaInicio: '', fechaFin: '', sucursal: 'Todas', vista: 'overview' };

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [mesFiltro, setMesFiltro] = useState<string>('');
  const [ccData, setCcData] = useState<CierreCajaResp | null>(null);
  const [vData, setVData] = useState<VentasResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ]).then(([cc, v]: [CierreCajaResp, VentasResp]) => {
      setCcData(cc);
      setVData(v);
      // Por defecto: mes más reciente
      if (cc.mesesDisponibles?.length) {
        const ultimo = [...cc.mesesDisponibles].sort().at(-1);
        if (ultimo) setMesFiltro(ultimo);
      }
    }).catch(() => toast('Error cargando datos', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Datos computados con filtros ────────────────────────────────────────────
  const computed = useMemo(() => {
    if (!ccData?.ok) return null;
    const { porLocal, porLocalMes, kpi, medioPago, chartData, mesesDisponibles } = ccData;
    const gastosPorMes = vData?.gastosPorMes ?? {};
    const gastosPorSucursal = vData?.porSucursal ?? {};
    const sucursal = filters.sucursal;
    const hasMes = !!mesFiltro;

    // Ventas por local (filtrado por mes si aplica)
    let ventasPorLocal: Record<string, number> = {};
    for (const local of Object.keys(porLocal)) {
      ventasPorLocal[local] = hasMes
        ? (porLocalMes[local]?.[mesFiltro]?.ventas ?? 0)
        : porLocal[local].ventas;
    }
    // Filtrar por sucursal si aplica
    if (sucursal !== 'Todas') {
      ventasPorLocal = { [sucursal]: ventasPorLocal[sucursal] ?? 0 };
    }

    const totalVentas = Object.values(ventasPorLocal).reduce((s, v) => s + v, 0);

    // Gastos totales
    let totalGastos = 0;
    if (sucursal === 'Todas') {
      totalGastos = hasMes
        ? (gastosPorMes[mesFiltro] ?? 0)
        : (vData?.kpi?.totalGastos ?? 0);
    } else {
      totalGastos = gastosPorSucursal[sucursal]?.gastos ?? 0;
      if (hasMes && totalGastos > 0) {
        // Aproximar gastos del mes para esta sucursal (proporción)
        const mesGastos = gastosPorMes[mesFiltro] ?? 0;
        const sucVentasTotales = porLocal[sucursal]?.ventas ?? 1;
        const sucVentasMes = porLocalMes[sucursal]?.[mesFiltro]?.ventas ?? 0;
        const ratio = sucVentasTotales > 0 ? sucVentasMes / sucVentasTotales : 0;
        totalGastos = mesGastos * ratio;
      }
    }

    const margen = totalVentas > 0 ? ((totalVentas - totalGastos) / totalVentas) * 100 : null;

    // Distribución para treemap
    const distribucion = Object.entries(ventasPorLocal)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, valor], i) => ({
        nombre,
        valor,
        porcentaje: totalVentas > 0 ? Math.round((valor / totalVentas) * 100) : 0,
        color: getSucursalColor(nombre, i),
      }));

    // Chart data: mensual, filtrado por sucursal si aplica
    const realChartData = mesesDisponibles.map((key, i) => {
      const [anio, mesNum] = key.split('-');
      const mes = parseInt(mesNum, 10);
      const dia = `${MESES_SHORT[mes]} ${anio}`;
      const ventas = sucursal === 'Todas'
        ? (chartData[i]?.ventas ?? 0)
        : (porLocalMes[sucursal]?.[key]?.ventas ?? 0);
      const gastos = gastosPorMes[key] ?? 0;
      return { dia, ventas, gastos };
    });

    // Medio de pago filtrado
    let medioPagoFiltrado = medioPago;
    const getLoc = () => sucursal !== 'Todas' ? porLocal[sucursal] : null;
    const getLocMes = () => sucursal !== 'Todas' && hasMes ? porLocalMes[sucursal]?.[mesFiltro] : null;
    const slice = getLocMes() ?? getLoc();
    if (slice) {
      const tot = slice.ventas || 1;
      medioPagoFiltrado = {
        efectivo: Math.round((slice.efectivo / tot) * 100),
        tarjeta: Math.round((slice.tarjeta / tot) * 100),
        transf: Math.round((slice.transf / tot) * 100),
      };
    } else if (hasMes && sucursal === 'Todas') {
      // Recalcular desde porLocalMes para ese mes
      let ef = 0, tar = 0, tr = 0, tot = 0;
      for (const local of Object.keys(porLocal)) {
        const s = porLocalMes[local]?.[mesFiltro];
        if (s) { ef += s.efectivo; tar += s.tarjeta; tr += s.transf; tot += s.ventas; }
      }
      if (tot > 0) {
        medioPagoFiltrado = {
          efectivo: Math.round((ef / tot) * 100),
          tarjeta: Math.round((tar / tot) * 100),
          transf: Math.round((tr / tot) * 100),
        };
      }
    }

    const topSucursal = distribucion[0] ?? null;

    return {
      totalVentas, totalGastos, margen, distribucion,
      realChartData, topSucursal, medioPago: medioPagoFiltrado,
      gastosPorSucursal,
      totalCierres: hasMes ? (kpi?.totalCierres ?? 0) : (kpi?.totalCierres ?? 0),
    };
  }, [ccData, vData, filters.sucursal, mesFiltro]);

  // Sucursales dinámicas desde la API
  const sucursalesDisponibles = useMemo(() => {
    if (!ccData?.porLocal) return ['Todas'];
    return ['Todas', ...sortSucursales(Object.keys(ccData.porLocal))];
  }, [ccData]);

  const handleExport = () => {
    if (!computed) return;
    exportToCSV(
      computed.distribucion.map(d => ({
        Sucursal: d.nombre,
        Ventas: d.valor,
        Gastos: computed.gastosPorSucursal[d.nombre]?.gastos ?? 0,
        'Participación %': `${d.porcentaje}%`,
      })),
      `dashboard_${mesFiltro || 'completo'}`
    );
    toast('Reporte exportado');
  };

  const periodoLabel = mesFiltro ? mesLabel(mesFiltro) : 'Acumulado';

  return (
    <div className="flex flex-col flex-1">
      <Header
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
        sucursalesDisponibles={sucursalesDisponibles}
      />

      <main className="flex-1 px-6 py-5 space-y-5 pb-8">

        {/* ── Filtro de mes ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Período:</span>
          <button
            onClick={() => setMesFiltro('')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
              mesFiltro === ''
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            Todo
          </button>
          {ccData?.mesesDisponibles.slice().sort().map(key => (
            <button
              key={key}
              onClick={() => setMesFiltro(key === mesFiltro ? '' : key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ${
                mesFiltro === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {mesLabel(key)}
            </button>
          ))}
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : computed && (
          <div className="grid grid-cols-4 gap-4">
            <KPICard
              label="Ventas Totales"
              value={formatCLPInt(computed.totalVentas)}
              sub={periodoLabel}
              icon={<Store size={16} />}
              accent="blue"
            />
            <KPICard
              label="Gastos Totales"
              value={formatCLPInt(computed.totalGastos)}
              sub={periodoLabel}
              icon={<Receipt size={16} />}
              accent="red"
            />
            <KPICard
              label="Margen Neto"
              value={computed.margen !== null ? `${computed.margen.toFixed(1)}%` : '—'}
              sub="Ventas - Gastos"
              delta={computed.margen !== null ? `${computed.margen.toFixed(1)}%` : undefined}
              deltaPositive={computed.margen !== null && computed.margen > 0}
              icon={<TrendingUp size={16} />}
              accent={computed.margen !== null && computed.margen > 0 ? 'green' : 'red'}
            />
            <KPICard
              label="Top Sucursal"
              value={computed.topSucursal?.nombre ?? '—'}
              sub={computed.topSucursal ? formatCLPInt(computed.topSucursal.valor) : ''}
              icon={<Building2 size={16} />}
              accent="blue"
            />
          </div>
        )}

        {/* ── Gráfico + Treemap ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <DailyPerformanceChart
              data={computed?.realChartData ?? []}
              chartType={filters.vista === 'granular' ? 'line' : 'bar'}
              loading={loading}
            />
          </div>
          <div className="col-span-1">
            <DistributionTreemap
              data={computed?.distribucion ?? []}
              onSucursalClick={(nombre) => {
                setFilters(f => ({ ...f, sucursal: f.sucursal === nombre ? 'Todas' : nombre }));
              }}
              activeSucursal={filters.sucursal}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Resumen tabla + Medio de pago ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-5 pb-6">
          <div className="col-span-2">
            <ResumenSucursales
              distribucion={computed?.distribucion ?? []}
              gastosPorSucursal={computed?.gastosPorSucursal ?? {}}
              totalVentas={computed?.totalVentas ?? 0}
              loading={loading}
            />
          </div>
          <div className="col-span-1">
            <PaymentBreakdown
              medioPago={computed?.medioPago ?? { efectivo: 0, tarjeta: 0, transf: 0 }}
              totalVentas={computed?.totalVentas ?? 0}
              loading={loading}
            />
          </div>
        </div>

      </main>
    </div>
  );
}
