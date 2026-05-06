'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Store, Receipt, TrendingUp, Building2, Calendar, ChevronDown, X, GitCompare } from 'lucide-react';
import { ComparisonPanel } from '@/components/ui/ComparisonPanel';
import clsx from 'clsx';
import Header from '@/components/layout/Header';
import DailyPerformanceChart from '@/components/dashboard/DailyPerformanceChart';
import DistributionTreemap from '@/components/dashboard/DistributionTreemap';
import ResumenSucursales from '@/components/dashboard/ResumenSucursales';
import PaymentBreakdown from '@/components/dashboard/PaymentBreakdown';
import KPICard from '@/components/kpis/KPICard';
import Skeleton from '@/components/ui/Skeleton';
import InsightsPanel from '@/components/insights/InsightsPanel';
import type { DashboardFilters } from '@/types';
import { getLocalRestriction } from '@/lib/session-client';
import type { CierreCajaResponse, VentasResponse } from '@/types/api';
import { toast } from '@/components/ui/Toast';
import { PeriodSelect } from '@/components/ui/PeriodSelect';
import { exportToCSV } from '@/lib/csv-export';
import { getSucursalColor, getSucursalConfig, sortSucursales } from '@/config/sucursales';
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
type ProductionSummary = { ventas: number; gastos: number };

function ssGet(key: string, fallback: string): string {
  try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function ssGetJSON<T>(key: string, fallback: T): T {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}

export default function DashboardPage() {
  const [filters, setFilters]   = useState<DashboardFilters>(defaultFilters);
  const [mesFiltro, setMesFiltro] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'dia'>('mes');
  const [dateOpen, setDateOpen] = useState(false);
  const [mesComp, setMesComp]       = useState('');
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>([]);
  const [compOn, setCompOn]         = useState(false);
  const [compareType, setCompareType] = useState<'mes' | 'local'>('mes');
  const [localA, setLocalA]         = useState('');
  const [localB, setLocalB]         = useState('');
  const dateRef = useRef<HTMLDivElement>(null);
  const [ccData, setCcData]     = useState<CierreCajaResponse | null>(null);
  const [vData, setVData]       = useState<VentasResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [produccionSummary, setProduccionSummary] = useState<ProductionSummary | null>(null);

  // Aplicar restricción de local si el rol es 'local'
  useEffect(() => {
    const localRestriccion = getLocalRestriction();
    if (localRestriccion) {
      setFilters(f => ({ ...f, sucursal: localRestriccion }));
    }
  }, []);

  // Restaurar estado desde sessionStorage tras el primer render (evita hydration mismatch)
  useEffect(() => {
    const localRestriccion = getLocalRestriction();
    if (localRestriccion) return; // no restaurar sessionStorage si hay restricción de local
    setFilters(ssGetJSON('dash_filters', defaultFilters));
    setMesFiltro(ssGet('dash_mesFiltro', ''));
    setFechaDesde(ssGet('dash_fechaDesde', ''));
    setFechaHasta(ssGet('dash_fechaHasta', ''));
    setModoFiltro(ssGet('dash_modoFiltro', 'mes') as 'mes' | 'dia');
    setMesComp(ssGet('dash_mesComp', ''));
    setCompOn(ssGet('dash_compOn', 'false') === 'true');
    setCompareType(ssGet('dash_compareType', 'mes') as 'mes' | 'local');
    setLocalA(ssGet('dash_localA', ''));
    setLocalB(ssGet('dash_localB', ''));
  }, []);

  // Persistir filtros en sessionStorage
  useEffect(() => { try { sessionStorage.setItem('dash_filters', JSON.stringify(filters)); } catch {} }, [filters]);
  useEffect(() => { try { sessionStorage.setItem('dash_mesFiltro', mesFiltro); } catch {} }, [mesFiltro]);
  useEffect(() => { try { sessionStorage.setItem('dash_modoFiltro', modoFiltro); } catch {} }, [modoFiltro]);
  useEffect(() => { try { sessionStorage.setItem('dash_fechaDesde', fechaDesde); } catch {} }, [fechaDesde]);
  useEffect(() => { try { sessionStorage.setItem('dash_fechaHasta', fechaHasta); } catch {} }, [fechaHasta]);
  useEffect(() => { try { sessionStorage.setItem('dash_compOn', String(compOn)); } catch {} }, [compOn]);
  useEffect(() => { try { sessionStorage.setItem('dash_compareType', compareType); } catch {} }, [compareType]);
  useEffect(() => { try { sessionStorage.setItem('dash_mesComp', mesComp); } catch {} }, [mesComp]);
  useEffect(() => { try { sessionStorage.setItem('dash_localA', localA); } catch {} }, [localA]);
  useEffect(() => { try { sessionStorage.setItem('dash_localB', localB); } catch {} }, [localB]);
  useEffect(() => { try { const v = ssGetJSON<string[]>('dash_selectedSucursales', []); if (v.length) setSelectedSucursales(v); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem('dash_selectedSucursales', JSON.stringify(selectedSucursales)); } catch {} }, [selectedSucursales]);

  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ]).then(([cc, v]: [CierreCajaResponse, VentasResponse]) => {
      setCcData(cc);
      setVData(v);
      if (cc.mesesDisponibles?.length) {
        const sorted = [...cc.mesesDisponibles].sort();
        const saved = ssGet('dash_mesFiltro', '');
        if (!saved || !sorted.includes(saved)) {
          const ultimo = sorted.at(-1);
          if (ultimo) setMesFiltro(ultimo);
        }
      }
    }).catch(() => toast('Error cargando datos', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (filters.sucursal !== 'Todas') {
      return;
    }

    const params = new URLSearchParams({ local: 'todos' });
    if (modoFiltro === 'dia') {
      if (!fechaDesde || !fechaHasta) {
        return;
      }
      params.set('fechaDesde', fechaDesde);
      params.set('fechaHasta', fechaHasta);
    } else {
      if (!mesFiltro) {
        return;
      }
      params.set('mesDesde', mesFiltro);
      params.set('mesHasta', mesFiltro);
    }

    let cancelled = false;
    fetch(`/api/produccion-data?${params}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d?.ok) {
          setProduccionSummary(null);
          return;
        }
        setProduccionSummary({
          ventas: d.kpi?.totalVentas ?? 0,
          gastos: d.kpi?.totalCostos ?? 0,
        });
      })
      .catch(() => {
        if (!cancelled) setProduccionSummary(null);
      });

    return () => { cancelled = true; };
  }, [filters.sucursal, modoFiltro, mesFiltro, fechaDesde, fechaHasta]);

  // Cierra el date picker al hacer click fuera
  useEffect(() => {
    if (!dateOpen) return;
    function handler(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dateOpen]);

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
    } else if (produccionSummary && (produccionSummary.ventas > 0 || produccionSummary.gastos > 0)) {
      ventasPorLocal['Producción'] = produccionSummary.ventas;
      gastosPorSucursal['Producción'] = { gastos: produccionSummary.gastos };
    }

    const totalVentas = Object.values(ventasPorLocal).reduce((s, v) => s + v, 0);

    const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
    let totalGastos = 0;
    if (sucursal === 'Todas') {
      totalGastos = hasMes ? (gastosPorMes[mesFiltro] ?? 0) : (vData?.kpi?.totalGastos ?? 0);
    } else if (hasMes) {
      // Usar gastosPorMesSucursal del server (usa col "mes" del sheet — más preciso)
      totalGastos = gastosPorMesSucursal[sucursal]?.[mesFiltro] ?? 0;
    } else {
      totalGastos = vData?.porSucursal?.[sucursal]?.gastos ?? 0;
    }
    if (sucursal === 'Todas') totalGastos += produccionSummary?.gastos ?? 0;

    const margen = totalVentas > 0 ? ((totalVentas - totalGastos) / totalVentas) * 100 : null;

    const distribucion = Object.entries(ventasPorLocal)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, valor], i) => ({
        nombre, valor,
        porcentaje: totalVentas > 0 ? Math.round((valor / totalVentas) * 100) : 0,
        color: getSucursalColor(nombre, i),
      }));

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
  }, [ccData, vData, filters.sucursal, mesFiltro, produccionSummary]);

  // ── Filtro por rango de días (calcula sobre registros diarios) ───────────
  const computedDateRange = useMemo(() => {
    if (modoFiltro !== 'dia' || (!fechaDesde && !fechaHasta)) return null;
    if (!ccData?.ok) return null;
    const sucursal = filters.sucursal;
    const dias     = (ccData as any).registrosDiarios ?? [];
    const gastosDias = vData?.registrosDiariosGastos ?? [];

    const ventasPorLocal: Record<string, number> = {};
    let ef = 0, tar = 0, tr = 0;
    for (const r of dias) {
      if (!r.fecha) continue;
      if (fechaDesde && r.fecha < fechaDesde) continue;
      if (fechaHasta && r.fecha > fechaHasta) continue;
      if (sucursal !== 'Todas' && r.local !== sucursal) continue;
      ventasPorLocal[r.local] = (ventasPorLocal[r.local] ?? 0) + r.ventas;
      ef += r.efectivo ?? 0; tar += r.tarjeta ?? 0; tr += r.transf ?? 0;
    }
    const gastosPorSucursal: Record<string, { gastos: number }> = {};
    let totalGastos = 0;
    for (const r of gastosDias) {
      if (!r.fecha) continue;
      if (fechaDesde && r.fecha < fechaDesde) continue;
      if (fechaHasta && r.fecha > fechaHasta) continue;
      if (sucursal !== 'Todas' && r.sucursal !== sucursal) continue;
      totalGastos += r.monto;
      if (r.sucursal) {
        if (!gastosPorSucursal[r.sucursal]) gastosPorSucursal[r.sucursal] = { gastos: 0 };
        gastosPorSucursal[r.sucursal].gastos += r.monto;
      }
    }
    if (sucursal === 'Todas' && produccionSummary && (produccionSummary.ventas > 0 || produccionSummary.gastos > 0)) {
      ventasPorLocal['Producción'] = produccionSummary.ventas;
      gastosPorSucursal['Producción'] = { gastos: produccionSummary.gastos };
      totalGastos += produccionSummary.gastos;
    }
    const totalVentas = Object.values(ventasPorLocal).reduce((s, v) => s + v, 0);
    const margen = totalVentas > 0 ? ((totalVentas - totalGastos) / totalVentas) * 100 : null;
    const distribucion = Object.entries(ventasPorLocal)
      .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
      .map(([nombre, valor], i) => ({
        nombre, valor,
        porcentaje: totalVentas > 0 ? Math.round((valor / totalVentas) * 100) : 0,
        color: getSucursalColor(nombre, i),
      }));
    return {
      totalVentas, totalGastos, margen, distribucion, gastosPorSucursal,
      realChartData: computed?.realChartData ?? [],
      topSucursal: distribucion[0] ?? null,
      medioPago: { efectivo: ef, tarjeta: tar, transf: tr },
    };
  }, [ccData, vData, fechaDesde, fechaHasta, modoFiltro, filters.sucursal, computed, produccionSummary]);

  // ── Datos activos (rango de días tiene prioridad sobre mes) ──────────────
  const activeData = computedDateRange ?? computed;

  // ── Comparación de período ────────────────────────────────────────────────
  const computedComp = useMemo(() => {
    if (!compOn || compareType !== 'mes' || !mesComp || !ccData?.ok) return null;
    const { porLocal, porLocalMes } = ccData;
    const gastosPorMes = vData?.gastosPorMes ?? {};
    const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
    const sucursal = filters.sucursal;

    let totalVentas = 0;
    for (const local of Object.keys(porLocal)) {
      if (sucursal !== 'Todas' && local !== sucursal) continue;
      totalVentas += porLocalMes[local]?.[mesComp]?.ventas ?? 0;
    }
    const totalGastos = sucursal === 'Todas'
      ? (gastosPorMes[mesComp] ?? 0)
      : (gastosPorMesSucursal[sucursal]?.[mesComp] ?? 0);

    return { totalVentas, totalGastos };
  }, [ccData, vData, mesComp, compOn, compareType, filters.sucursal]);

  // ── Comparación de locales (mismo período) ────────────────────────────────
  const computedCompLocal = useMemo(() => {
    if (!compOn || compareType !== 'local' || !localA || !localB || !ccData?.ok) return null;
    const { porLocalMes, porLocal } = ccData;
    const gastosPorMesSucursal = vData?.gastosPorMesSucursal ?? {};
    const mes = mesFiltro;

    const getData = (local: string) => {
      const totalVentas = mes
        ? (porLocalMes[local]?.[mes]?.ventas ?? 0)
        : Object.values(porLocalMes[local] ?? {}).reduce((s, m) => s + m.ventas, 0);
      const totalGastos = mes
        ? (gastosPorMesSucursal[local]?.[mes] ?? 0)
        : Object.values(gastosPorMesSucursal[local] ?? {}).reduce((s, v) => s + v, 0);
      return { totalVentas, totalGastos };
    };

    return { dataA: getData(localA), dataB: getData(localB) };
  }, [ccData, vData, compOn, compareType, localA, localB, mesFiltro]);

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

  // ── Datos del gráfico por sucursal seleccionada (multi-compare) ──────────
  const sucursalSeriesConfig = useMemo(() => {
    return selectedSucursales.map(nombre => ({
      nombre,
      color: getSucursalColor(nombre),
    }));
  }, [selectedSucursales]);

  const sucursalChartData = useMemo(() => {
    if (!selectedSucursales.length || !ccData?.ok) return null;
    const { porLocalMes, mesesDisponibles } = ccData;
    return mesesDisponibles.map((key) => {
      const mes = parseInt(key.split('-')[1], 10);
      const row: Record<string, any> = { dia: MESES_SHORT[mes] + ' ' + key.split('-')[0] };
      for (const suc of selectedSucursales) {
        row[suc] = porLocalMes[suc]?.[key]?.ventas ?? 0;
      }
      return row;
    });
  }, [ccData, selectedSucursales]);

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

  const periodoLabel = modoFiltro === 'dia' && (fechaDesde || fechaHasta)
    ? `${fechaDesde || '…'} → ${fechaHasta || '…'}`
    : mesFiltro ? mesLabel(mesFiltro) : 'Acumulado';

  // Deltas vs comparación
  const ventasDelta = (compOn && computedComp && activeData && computedComp.totalVentas > 0)
    ? ((activeData.totalVentas - computedComp.totalVentas) / computedComp.totalVentas) * 100 : null;
  const gastosDelta = (compOn && computedComp && activeData && computedComp.totalGastos > 0)
    ? ((activeData.totalGastos - computedComp.totalGastos) / computedComp.totalGastos) * 100 : null;
  const compLabel = mesComp ? `vs ${mesLabel(mesComp)}` : '';

  return (
    <div className="flex flex-col flex-1">
      <Header
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
        sucursalesDisponibles={sucursalesDisponibles}
      />

      <main className="flex-1 px-4 lg:px-6 py-4 lg:py-5 space-y-4 lg:space-y-5 pb-6">

        {/* ── Filtros ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de mes */}
          {modoFiltro === 'mes' && (
            <PeriodSelect
              label="Período"
              value={mesFiltro}
              options={(ccData?.mesesDisponibles ?? []).slice().sort().map(key => ({ label: mesLabel(key), value: key }))}
              onChange={v => { setMesFiltro(v); setModoFiltro('mes'); }}
              allLabel="Todos los meses"
            />
          )}

          {/* Botón rango de días */}
          <div className="relative" ref={dateRef}>
            <button
              onClick={() => setDateOpen(o => !o)}
              className={clsx(
                'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
                modoFiltro === 'dia'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
              )}
            >
              <Calendar className="w-3.5 h-3.5 opacity-80" />
              <span className="font-semibold text-[11px]">
                {modoFiltro === 'dia' && (fechaDesde || fechaHasta)
                  ? `${fechaDesde || '…'} → ${fechaHasta || '…'}`
                  : 'Rango días'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {dateOpen && (
              <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4 min-w-[260px]">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Rango de fechas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Desde</label>
                    <input type="date" value={fechaDesde}
                      onChange={e => { setFechaDesde(e.target.value); setModoFiltro('dia'); setMesFiltro(''); }}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Hasta</label>
                    <input type="date" value={fechaHasta}
                      onChange={e => { setFechaHasta(e.target.value); setModoFiltro('dia'); setMesFiltro(''); }}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-blue-400 transition-colors" />
                  </div>
                </div>
                {modoFiltro === 'dia' && (
                  <button onClick={() => { setFechaDesde(''); setFechaHasta(''); setModoFiltro('mes'); setDateOpen(false); }}
                    className="mt-3 text-[11px] text-red-400 hover:text-red-600 font-semibold flex items-center gap-1">
                    <X className="w-3 h-3" /> Limpiar y volver a mes
                  </button>
                )}
                <button onClick={() => setDateOpen(false)}
                  className="mt-3 w-full text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors">
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Separador */}
          <span className="border-l border-gray-200 h-4 mx-1" />

          {/* Toggle comparación */}
          <button
            onClick={() => {
              const next = !compOn;
              setCompOn(next);
              if (next) {
                const meses = (ccData?.mesesDisponibles ?? []).slice().sort();
                const idx = mesFiltro ? meses.indexOf(mesFiltro) : meses.length - 1;
                if (!mesComp) setMesComp(idx > 0 ? meses[idx - 1] : meses[0] ?? '');
                const sucs = Object.keys(ccData?.porLocal ?? {});
                if (!localA && sucs.length >= 1) setLocalA(sucs[0]);
                if (!localB && sucs.length >= 2) setLocalB(sucs[1]);
              }
            }}
            className={clsx(
              'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all',
              compOn
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-600',
            )}
          >
            <GitCompare className="w-3.5 h-3.5 opacity-80" />
            <span className="font-semibold text-[11px]">Comparar</span>
          </button>

          {/* Tipo de comparación + selectores */}
          {compOn && (
            <>
              {/* Toggle Meses / Locales */}
              <div className="flex items-center rounded-xl overflow-hidden border border-gray-200">
                {(['mes', 'local'] as const).map(t => (
                  <button key={t} onClick={() => setCompareType(t)}
                    className={clsx(
                      'px-3 py-2 text-[11px] font-semibold transition-all',
                      compareType === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
                    )}>
                    {t === 'mes' ? 'Meses' : 'Locales'}
                  </button>
                ))}
              </div>

              {compareType === 'mes' ? (
                <PeriodSelect
                  label="vs"
                  value={mesComp}
                  options={(ccData?.mesesDisponibles ?? []).slice().sort().map(key => ({ label: mesLabel(key), value: key }))}
                  onChange={setMesComp}
                  allLabel="Seleccionar mes"
                />
              ) : (
                <>
                  <select value={localA} onChange={e => setLocalA(e.target.value)}
                    className="border border-blue-300 bg-blue-50 rounded-xl px-3 py-2 text-[12px] font-semibold text-blue-700 outline-none">
                    {sucursalesDisponibles.filter(s => s !== 'Todas').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-[11px] font-bold">vs</span>
                  <select value={localB} onChange={e => setLocalB(e.target.value)}
                    className="border border-purple-300 bg-purple-50 rounded-xl px-3 py-2 text-[12px] font-semibold text-purple-700 outline-none">
                    {sucursalesDisponibles.filter(s => s !== 'Todas').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}
        </div>

        {/* ── Panel de Comparación ────────────────────────────────────────── */}
        {compOn && (compareType === 'mes' ? !!computedComp : !!computedCompLocal) && (
          <ComparisonPanel
            labelA={
              compareType === 'mes'
                ? periodoLabel
                : (localA || '—')
            }
            labelB={
              compareType === 'mes'
                ? (mesComp ? mesLabel(mesComp) : '—')
                : (localB || '—')
            }
            colorA="#3B82F6"
            colorB="#8B5CF6"
            loading={loading}
            metrics={[
              {
                label: 'Ventas',
                valueA: compareType === 'mes'
                  ? (activeData?.totalVentas ?? 0)
                  : (computedCompLocal?.dataA.totalVentas ?? 0),
                valueB: compareType === 'mes'
                  ? (computedComp?.totalVentas ?? 0)
                  : (computedCompLocal?.dataB.totalVentas ?? 0),
                format: formatCLPInt,
                higherIsBetter: true,
              },
              {
                label: 'Gastos',
                valueA: compareType === 'mes'
                  ? (activeData?.totalGastos ?? 0)
                  : (computedCompLocal?.dataA.totalGastos ?? 0),
                valueB: compareType === 'mes'
                  ? (computedComp?.totalGastos ?? 0)
                  : (computedCompLocal?.dataB.totalGastos ?? 0),
                format: formatCLPInt,
                higherIsBetter: false,
              },
              {
                label: 'Margen %',
                valueA: (() => {
                  const v = compareType === 'mes' ? (activeData?.totalVentas ?? 0) : (computedCompLocal?.dataA.totalVentas ?? 0);
                  const g = compareType === 'mes' ? (activeData?.totalGastos ?? 0) : (computedCompLocal?.dataA.totalGastos ?? 0);
                  return v > 0 ? parseFloat(((v - g) / v * 100).toFixed(1)) : null;
                })(),
                valueB: (() => {
                  const v = compareType === 'mes' ? (computedComp?.totalVentas ?? 0) : (computedCompLocal?.dataB.totalVentas ?? 0);
                  const g = compareType === 'mes' ? (computedComp?.totalGastos ?? 0) : (computedCompLocal?.dataB.totalGastos ?? 0);
                  return v > 0 ? parseFloat(((v - g) / v * 100).toFixed(1)) : null;
                })(),
                format: (v) => v.toFixed(1) + '%',
                higherIsBetter: true,
              },
            ]}
          />
        )}

        {/* ── KPI Cards (2 cols mobile, 4 cols desktop) ───────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : activeData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <KPICard
              label="Ventas Totales"
              value={formatCLPInt(activeData.totalVentas)}
              sub={ventasDelta !== null
                ? `${ventasDelta >= 0 ? '+' : ''}${ventasDelta.toFixed(1)}% ${compLabel}`
                : periodoLabel}
              delta={ventasDelta !== null ? String(ventasDelta) : undefined}
              deltaPositive={ventasDelta !== null && ventasDelta >= 0}
              icon={<Store size={16} />}
              accent="blue"
            />
            <KPICard
              label="Gastos Totales"
              value={formatCLPInt(activeData.totalGastos)}
              sub={gastosDelta !== null
                ? `${gastosDelta >= 0 ? '+' : ''}${gastosDelta.toFixed(1)}% ${compLabel}`
                : periodoLabel}
              delta={gastosDelta !== null ? String(gastosDelta) : undefined}
              deltaPositive={gastosDelta !== null && gastosDelta < 0}
              icon={<Receipt size={16} />}
              accent="red"
            />
            <KPICard
              label="Margen Neto"
              value={activeData.margen !== null ? activeData.margen.toFixed(1) + '%' : '—'}
              sub="Ventas - Gastos"
              delta={activeData.margen !== null ? activeData.margen.toFixed(1) + '%' : undefined}
              deltaPositive={activeData.margen !== null && activeData.margen > 0}
              icon={<TrendingUp size={16} />}
              accent={activeData.margen !== null && activeData.margen > 0 ? 'green' : 'red'}
            />
            <KPICard
              label="Top Sucursal"
              value={activeData.topSucursal?.nombre ?? '—'}
              sub={activeData.topSucursal ? formatCLPInt(activeData.topSucursal.valor) : ''}
              icon={<Building2 size={16} />}
              accent="blue"
            />
          </div>
        )}

        {/* ── Gráfico principal + distribución (1 col mobile, 3 cols desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2">
            <DailyPerformanceChart
              data={sucursalChartData ?? (activeData?.realChartData ?? [])}
              chartType={filters.vista === 'granular' ? 'line' : 'bar'}
              loading={loading}
              accentColor={filters.sucursal !== 'Todas' ? getSucursalConfig(filters.sucursal).color : '#2563EB'}
              sucursalSeries={sucursalSeriesConfig}
            />
          </div>
          <div className="lg:col-span-1">
            <DistributionTreemap
              data={activeData?.distribucion ?? []}
              onSucursalToggle={(nombre) =>
                setSelectedSucursales(prev =>
                  prev.includes(nombre) ? prev.filter(s => s !== nombre) : [...prev, nombre]
                )
              }
              onClearSelection={() => setSelectedSucursales([])}
              activeSucursales={selectedSucursales}
              loading={loading}
            />
          </div>
        </div>

        {/* ── Resumen sucursales + medio de pago ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2">
            <ResumenSucursales
              distribucion={activeData?.distribucion ?? []}
              gastosPorSucursal={activeData?.gastosPorSucursal ?? {}}
              totalVentas={activeData?.totalVentas ?? 0}
              loading={loading}
            />
          </div>
          <div className="lg:col-span-1">
            <PaymentBreakdown
              medioPago={activeData?.medioPago ?? { efectivo: 0, tarjeta: 0, transf: 0 }}
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
