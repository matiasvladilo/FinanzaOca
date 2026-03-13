'use client';

import { useState, useEffect, useMemo } from 'react';
import { Store, Receipt, TrendingUp, Building2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import DailyPerformanceChart from '@/components/dashboard/DailyPerformanceChart';
import DistributionTreemap from '@/components/dashboard/DistributionTreemap';
import ResumenSucursales from '@/components/dashboard/ResumenSucursales';
import PaymentBreakdown from '@/components/dashboard/PaymentBreakdown';
import KPICard from '@/components/kpis/KPICard';
import Skeleton from '@/components/ui/Skeleton';
import InsightsPanel from '@/components/insights/InsightsPanel';
import type { DashboardFilters } from '@/types';
import type { CierreCajaResponse, VentasResponse } from '@/types/api';
import { toast } from '@/components/ui/Toast';
import { exportToCSV } from '@/lib/csv-export';
import { getSucursalColor, sortSucursales } from '@/config/sucursales';
import { computeTrendInsights, computeMarginInsight } from '@/lib/analytics/trends';
import { computeRankingInsights } from '@/lib/analytics/rankings';

const MESES_SHORT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatCLPInt(v: number) {
  return '$' + Math.round(v).toLocaleString('es-CL');
}
function mesLabel(key: string) {
  const [anio, mes] = key.split('-');
  return (MESES_FULL[mes] ?? mes) + ' ' + anio;
}

function getPreviousMonthKey(key: string): string {
  const [anio, mes] = key.split('-').map(Number);
  const prev = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  return `${prev.anio}-${String(prev.mes).padStart(2, '0')}`;
}

const defaultFilters: DashboardFilters = { fechaInicio: '', fechaFin: '', sucursal: 'Todas', vista: 'overview' };

export default function DashboardPage() {
  const [filters, setFilters]   = useState<DashboardFilters>(defaultFilters);
  const [mesFiltro, setMesFiltro] = useState<string>('');
  const [ccData, setCcData]     = useState<CierreCajaResponse | null>(null);
  const [vData, setVData]       = useState<VentasResponse | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ]).then(([cc, v]: [CierreCajaResponse, VentasResponse]) => {
      setCcData(cc);
      setVData(v);
      if (cc.mesesDisponibles?.length) {
        const ultimo = [...cc.mesesDisponibles].sort().at(-1);
        if (ultimo) setMesFiltro(ultimo);
      }
    }).catch(() => toast('Error cargando datos', 'error'))
      .finally(() => setLoading(false));
  }, []);

  // ── Cálculos del dashboard (memoizados) ──────────────────────────────────
  const computed = useMemo(() => {
    if (!ccData?.ok) return null;
    const { porLocal, porLocalMes, chartData, mesesDisponibles } = ccData;
    const gastosPorMes = vData?.gastosPorMes ?? {};

    const registrosDiarios = vData?.registrosDiariosGastos ?? [];
    const gastosPorSucursal: Record<string, { gastos: number }> = {};
    if (mesFiltro && registrosDiarios.length > 0) {
      for (const r of registrosDiarios) {
        if (!r.fecha || r.fecha.slice(0, 7) !== mesFiltro) continue;
        if (!gastosPorSucursal[r.sucursal]) gastosPorSucursal[r.sucursal] = { gastos: 0 };
        gastosPorSucursal[r.sucursal].gastos += r.monto;
      }
    } else {
      for (const [suc, d] of Object.entries(vData?.porSucursal ?? {})) {
        gastosPorSucursal[suc] = { gastos: d.gastos };
      }
    }

    const sucursal = filters.sucursal;
    const hasMes   = !!mesFiltro;

    let ventasPorLocal: Record<string, number> = {};
    for (const local of Object.keys(porLocal)) {
      ventasPorLocal[local] = hasMes
        ? (porLocalMes[local]?.[mesFiltro]?.ventas ?? 0)
        : porLocal[local].ventas;
    }
    if (sucursal !== 'Todas') {
      ventasPorLocal = { [sucursal]: ventasPorLocal[sucursal] ?? 0 };
    }

    const totalVentas = Object.values(ventasPorLocal).reduce((s, v) => s + v, 0);

    let totalGastos = 0;
    if (sucursal === 'Todas') {
      totalGastos = hasMes ? (gastosPorMes[mesFiltro] ?? 0) : (vData?.kpi?.totalGastos ?? 0);
    } else {
      totalGastos = gastosPorSucursal[sucursal]?.gastos ?? 0;
    }

    const margen = totalVentas > 0 ? ((totalVentas - totalGastos) / totalVentas) * 100 : null;

    const distribucion = Object.entries(ventasPorLocal)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, valor], i) => ({
        nombre, valor,
        porcentaje: totalVentas > 0 ? Math.round((valor / totalVentas) * 100) : 0,
        color: getSucursalColor(nombre, i),
      }));

    const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
    const realChartData = mesesDisponibles.map((key, i) => {
      const mes = parseInt(key.split('-')[1], 10);
      const ventas = sucursal === 'Todas'
        ? (chartData[i]?.ventas ?? 0)
        : (porLocalMes[sucursal]?.[key]?.ventas ?? 0);
      const gastos = sucursal === 'Todas'
        ? (gastosPorMes[key] ?? 0)
        : (gastosPorMesSucursal[sucursal]?.[key] ?? 0);
      return { dia: MESES_SHORT[mes] + ' ' + key.split('-')[0], ventas, gastos };
    });

    let medioPagoMontos = {
      efectivo: ccData.kpi?.totalEfectivo ?? 0,
      tarjeta:  ccData.kpi?.totalTarjeta  ?? 0,
      transf:   ccData.kpi?.totalTransf   ?? 0,
    };
    const slice = (sucursal !== 'Todas' && hasMes)
      ? porLocalMes[sucursal]?.[mesFiltro]
      : (sucursal !== 'Todas' ? porLocal[sucursal] : null);
    if (slice) {
      medioPagoMontos = { efectivo: slice.efectivo, tarjeta: slice.tarjeta, transf: slice.transf };
    } else if (hasMes) {
      let ef = 0, tar = 0, tr = 0;
      for (const local of Object.keys(porLocal)) {
        const s = porLocalMes[local]?.[mesFiltro];
        if (s) { ef += s.efectivo; tar += s.tarjeta; tr += s.transf; }
      }
      medioPagoMontos = { efectivo: ef, tarjeta: tar, transf: tr };
    }

    return {
      totalVentas, totalGastos, margen, distribucion, realChartData,
      topSucursal: distribucion[0] ?? null,
      medioPago: medioPagoMontos,
      gastosPorSucursal,
    };
  }, [ccData, vData, filters.sucursal, mesFiltro]);

  // ── Insights automáticos (memoizados) ────────────────────────────────────
  const insights = useMemo(() => {
    if (!ccData?.ok || !mesFiltro) return [];
    const { porLocalMes, porLocal } = ccData;
    const prevKey = getPreviousMonthKey(mesFiltro);

    const trendLocales = Object.keys(porLocal).map(nombre => ({
      nombre,
      ventasMesActual:   porLocalMes[nombre]?.[mesFiltro]?.ventas ?? 0,
      ventasMesAnterior: porLocalMes[nombre]?.[prevKey]?.ventas   ?? 0,
    }));

    const rankingLocales = Object.keys(porLocal).map(nombre => ({
      nombre,
      ventas: porLocalMes[nombre]?.[mesFiltro]?.ventas ?? 0,
    }));

    const marginInsight = computed
      ? computeMarginInsight(computed.totalVentas, computed.totalGastos, mesFiltro)
      : null;

    return [
      ...computeRankingInsights(rankingLocales, mesFiltro),
      ...computeTrendInsights(trendLocales, mesFiltro),
      ...(marginInsight ? [marginInsight] : []),
    ];
  }, [ccData, mesFiltro, computed]);

  // ── Sucursales para el filtro del Header ─────────────────────────────────
  const sucursalesDisponibles = useMemo(() => {
    if (!ccData?.porLocal) return ['Todas'];
    return ['Todas', ...sortSucursales(Object.keys(ccData.porLocal))];
  }, [ccData]);

  const handleExport = () => {
    if (!computed) return;
    exportToCSV(
      computed.distribucion.map(d => ({
        Sucursal:         d.nombre,
        Ventas:           d.valor,
        Gastos:           computed.gastosPorSucursal[d.nombre]?.gastos ?? 0,
        'Participacion %': d.porcentaje + '%',
      })),
      'dashboard_' + (mesFiltro || 'completo')
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

      <main className="flex-1 px-4 lg:px-6 py-4 lg:py-5 space-y-4 lg:space-y-5 pb-6">

        {/* ── Filtros de período ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-1">
            Período:
          </span>
          <button
            onClick={() => setMesFiltro('')}
            className={'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ' + (
              mesFiltro === ''
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
            )}
          >
            Todo
          </button>
          {ccData?.mesesDisponibles.slice().sort().map(key => (
            <button
              key={key}
              onClick={() => setMesFiltro(key === mesFiltro ? '' : key)}
              className={'px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all border ' + (
                mesFiltro === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:text-blue-600 dark:hover:text-blue-400'
              )}
            >
              {mesLabel(key)}
            </button>
          ))}
        </div>

        {/* ── KPI Cards (2 cols mobile, 4 cols desktop) ───────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : computed && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
              value={computed.margen !== null ? computed.margen.toFixed(1) + '%' : '—'}
              sub="Ventas - Gastos"
              delta={computed.margen !== null ? computed.margen.toFixed(1) + '%' : undefined}
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

        {/* ── Gráfico principal + distribución (1 col mobile, 3 cols desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2">
            <DailyPerformanceChart
              data={computed?.realChartData ?? []}
              chartType={filters.vista === 'granular' ? 'line' : 'bar'}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-1">
            <DistributionTreemap
              data={computed?.distribucion ?? []}
              onSucursalClick={(nombre) =>
                setFilters(f => ({ ...f, sucursal: f.sucursal === nombre ? 'Todas' : nombre }))
              }
              activeSucursal={filters.sucursal}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Resumen sucursales + medio de pago ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2">
            <ResumenSucursales
              distribucion={computed?.distribucion ?? []}
              gastosPorSucursal={computed?.gastosPorSucursal ?? {}}
              totalVentas={computed?.totalVentas ?? 0}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-1">
            <PaymentBreakdown
              medioPago={computed?.medioPago ?? { efectivo: 0, tarjeta: 0, transf: 0 }}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Insights automáticos ────────────────────────────────────────── */}
        <InsightsPanel insights={insights} loading={loading} />

      </main>
    </div>
  );
}
