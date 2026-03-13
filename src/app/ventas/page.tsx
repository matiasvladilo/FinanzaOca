'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Search, Bell, Calendar, ChevronDown, MapPin,
  Download, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart,
  BarChart2, Receipt, Activity, LayoutGrid,
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';

// ─── tipos ───────────────────────────────────────────────
type Periodo = '7D' | '14D' | '30D';
type Metrica = 'ventas' | 'gastos' | 'ambos';
type TipoGrafico = 'area' | 'linea' | 'barras';
// ─── datos crudos por período (fallback sin conexión) ────
const rawData: Record<Periodo, { fecha: string; ventas: number; gastos: number }[]> = {
  '7D': [
    { fecha: 'Lun', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Mar', ventas: 3900000, gastos: 1950000 },
    { fecha: 'Mié', ventas: 5200000, gastos: 2400000 },
    { fecha: 'Jue', ventas: 7100000, gastos: 3200000 },
    { fecha: 'Vie', ventas: 6400000, gastos: 2900000 },
    { fecha: 'Sáb', ventas: 8900000, gastos: 3600000 },
    { fecha: 'Dom', ventas: 6200000, gastos: 2700000 },
  ],
  '14D': [
    { fecha: 'Jun 17', ventas: 3600000, gastos: 1700000 },
    { fecha: 'Jun 18', ventas: 4200000, gastos: 1900000 },
    { fecha: 'Jun 19', ventas: 3800000, gastos: 1800000 },
    { fecha: 'Jun 20', ventas: 5100000, gastos: 2300000 },
    { fecha: 'Jun 21', ventas: 4700000, gastos: 2100000 },
    { fecha: 'Jun 22', ventas: 8200000, gastos: 3400000 },
    { fecha: 'Jun 23', ventas: 6100000, gastos: 2600000 },
    { fecha: 'Jun 24', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Jun 25', ventas: 3900000, gastos: 1950000 },
    { fecha: 'Jun 26', ventas: 5200000, gastos: 2400000 },
    { fecha: 'Jun 27', ventas: 7100000, gastos: 3200000 },
    { fecha: 'Jun 28', ventas: 6400000, gastos: 2900000 },
    { fecha: 'Jun 29', ventas: 8900000, gastos: 3600000 },
    { fecha: 'Jun 30', ventas: 6200000, gastos: 2700000 },
  ],
  '30D': [
    { fecha: 'Jun 01', ventas: 3200000, gastos: 1500000 },
    { fecha: 'Jun 04', ventas: 3800000, gastos: 1750000 },
    { fecha: 'Jun 07', ventas: 3500000, gastos: 1600000 },
    { fecha: 'Jun 10', ventas: 4200000, gastos: 1900000 },
    { fecha: 'Jun 13', ventas: 3900000, gastos: 1800000 },
    { fecha: 'Jun 16', ventas: 3100000, gastos: 1450000 },
    { fecha: 'Jun 19', ventas: 5800000, gastos: 2600000 },
    { fecha: 'Jun 22', ventas: 7200000, gastos: 3200000 },
    { fecha: 'Jun 25', ventas: 6100000, gastos: 2700000 },
    { fecha: 'Jun 28', ventas: 4800000, gastos: 2100000 },
    { fecha: 'Jun 30', ventas: 6200000, gastos: 2700000 },
  ],
};



const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`;
const fmtFull = (v: number) => `$${v.toLocaleString('es-CL')}`;

// ─── Tipo fila del gráfico ────────────────────────────────
type ChartRow = {
  fecha: string; ventas: number; gastos: number;
  ventasComp?: number; gastosComp?: number; fechaComp?: string;
};

// ─── Tooltip custom ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const main = payload.filter((p: any) => !String(p.dataKey).endsWith('Comp'));
  const comp = payload.filter((p: any) => String(p.dataKey).endsWith('Comp'));
  const fechaComp = payload[0]?.payload?.fechaComp;
  return (
    <div className="rounded-xl shadow-lg px-4 py-3 text-[12px]"
      style={{ background: 'var(--card)', border: '1px solid var(--border-2)', color: 'var(--text)' }}>
      <p className="font-semibold mb-2" style={{ color: 'var(--text-2)' }}>{label}</p>
      {main.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color ?? p.fill }} />
          <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text)' }}>{fmtFull(p.value)}</span>
        </div>
      ))}
      {comp.length > 0 && (
        <>
          <div className="border-t border-dashed my-1.5" style={{ borderColor: 'var(--border)' }} />
          {fechaComp && <p className="text-[10px] mb-1" style={{ color: 'var(--text-3)' }}>{fechaComp}</p>}
          {comp.map((p: any) => (
            <div key={p.name} className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full opacity-50" style={{ backgroundColor: p.color ?? p.fill }} />
              <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
              <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{fmtFull(p.value)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ─── Componente del gráfico interactivo ──────────────────
function InteractiveChart({
  data, metrica, tipo, hasComp,
}: {
  data: ChartRow[];
  metrica: Metrica;
  tipo: TipoGrafico;
  hasComp?: boolean;
}) {
  const yFmt = (v: number) => fmt(v);
  const showVentas = metrica === 'ventas' || metrica === 'ambos';
  const showGastos = metrica === 'gastos' || metrica === 'ambos';

  const commonChildren = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} tickFormatter={yFmt} width={52} />
      <Tooltip content={<CustomTooltip />} />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
        formatter={(v) => <span style={{ color: 'var(--chart-axis)' }}>{v}</span>} />
    </>
  );

  if (tipo === 'area') return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} style={{ background: 'transparent' }}>
        <defs>
          <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        {commonChildren}
        {showVentas && <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#3B82F6" strokeWidth={3} fill="url(#gV)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />}
        {showGastos && <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#EF4444" strokeWidth={2.5} fill="url(#gG)" dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />}
        {hasComp && showVentas && <Area type="monotone" dataKey="ventasComp" name="Ventas (comp.)" stroke="#93C5FD" strokeWidth={2} strokeDasharray="5 3" fill="none" dot={false} activeDot={{ r: 4 }} />}
        {hasComp && showGastos && <Area type="monotone" dataKey="gastosComp" name="Gastos (comp.)" stroke="#FCA5A5" strokeWidth={2} strokeDasharray="5 3" fill="none" dot={false} activeDot={{ r: 4 }} />}
      </AreaChart>
    </ResponsiveContainer>
  );

  if (tipo === 'linea') return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} style={{ background: 'transparent' }}>
        {commonChildren}
        {showVentas && <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />}
        {showGastos && <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 3, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />}
        {hasComp && showVentas && <Line type="monotone" dataKey="ventasComp" name="Ventas (comp.)" stroke="#93C5FD" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />}
        {hasComp && showGastos && <Line type="monotone" dataKey="gastosComp" name="Gastos (comp.)" stroke="#FCA5A5" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />}
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="30%" barGap={2} style={{ background: 'transparent' }}>
        {commonChildren}
        {showVentas && <Bar dataKey="ventas" name="Ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />}
        {showGastos && <Bar dataKey="gastos" name="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />}
        {hasComp && showVentas && <Bar dataKey="ventasComp" name="Ventas (comp.)" fill="#93C5FD" radius={[4, 4, 0, 0]} />}
        {hasComp && showGastos && <Bar dataKey="gastosComp" name="Gastos (comp.)" fill="#FCA5A5" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Helpers ─────────────────────────────────────────────
const MESES_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function keyToLabel(key: string) {
  const [anio, mes] = key.split('-');
  return `${MESES_LABELS[parseInt(mes, 10)]} ${anio}`;
}
type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
type DiaCaja = { fecha: string; local: string; ventas: number; efectivo: number; tarjeta: number; transf: number };
type DiaGasto = { fecha: string; sucursal: string; monto: number; proveedor?: string; subtipo?: string };

// Obtiene el lunes de la semana de una fecha ISO
// FIX: no usar toISOString() — da fecha UTC, en UTC-3 devuelve domingo en lugar de lunes
function getLunesSemana(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(date.getTime())) return isoDate;
  const day = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(y, m - 1, d + diffToMonday, 0, 0, 0, 0);
  if (isNaN(monday.getTime())) return isoDate;
  // Construir YYYY-MM-DD desde partes LOCALES — nunca toISOString() (da UTC)
  const my = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const md = String(monday.getDate()).padStart(2, '0');
  return `${my}-${mm}-${md}`;
}

function formatDayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)}/${parseInt(m)}`;
}
function formatWeekLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `Sem ${parseInt(d)}/${parseInt(m)}`;
}

// ─── Página principal ─────────────────────────────────────
export default function VentasPage() {
  const [sucursal, setSucursal] = useState('Todas');
  const [sucursalOpen, setSucursalOpen] = useState(false);
  const [metrica, setMetrica] = useState<Metrica>('ambos');
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('area');
  // ── Estado raw desde Sheets ──────────────────────────────
  const [rawLocalMes, setRawLocalMes] = useState<Record<string, Record<string, MesSlice>>>({});
  const [rawGastosMes, setRawGastosMes] = useState<Record<string, number>>({});
  const [rawGastosMesSucursal, setRawGastosMesSucursal] = useState<Record<string, Record<string, number>>>({});
  const [rawDiasCaja, setRawDiasCaja] = useState<DiaCaja[]>([]);
  const [rawDiasGastos, setRawDiasGastos] = useState<DiaGasto[]>([]);
  const [mesesDisponibles, setMesesDisponibles] = useState<string[]>([]);
  const [mesDesde, setMesDesde] = useState('');
  const [mesHasta, setMesHasta] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  // 'mes' = filtro por rango de meses | 'dia' = filtro por día/semana exacta
  const [modoFiltro, setModoFiltro] = useState<'mes' | 'dia'>('mes');
  // Comparación
  const [compEnabled, setCompEnabled] = useState(false);
  const [compMesDesde, setCompMesDesde] = useState('');
  const [compMesHasta, setCompMesHasta] = useState('');
  const [compFechaDesde, setCompFechaDesde] = useState('');
  const [compFechaHasta, setCompFechaHasta] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/cierre-caja').then(r => r.json()),
      fetch('/api/ventas').then(r => r.json()),
    ])
      .then(([caja, facturas]) => {
        if (caja.ok) {
          setRawLocalMes(caja.porLocalMes ?? {});
          setRawDiasCaja(caja.registrosDiarios ?? []);
        }
        const gastosPorMes: Record<string, number> = facturas.ok ? (facturas.gastosPorMes ?? {}) : {};
        if (facturas.ok) {
          setRawGastosMes(gastosPorMes);
          setRawDiasGastos(facturas.registrosDiariosGastos ?? []);
          setRawGastosMesSucursal(facturas.gastosPorMesSucursal ?? {});
        }

        // Unión de meses de ambas fuentes (YYYY-MM), ordenados
        const setCaja    = new Set<string>(caja.ok     ? (caja.mesesDisponibles ?? [])        : []);
        const setFactura = new Set<string>(facturas.ok ? Object.keys(gastosPorMes)             : []);
        const meses = [...new Set([...setCaja, ...setFactura])].sort();
        setMesesDisponibles(meses);
        if (meses.length) { setMesDesde(meses[0]); setMesHasta(meses[meses.length - 1]); }
      })
      .catch(() => {})
      .finally(() => setLoadingSheet(false));
  }, []);

  // ── Datos filtrados ──────────────────────────────────────
  const filteredData = useMemo(() => {
    // ── Helper: chart data para un rango de días ─────────────────────────────
    function buildDayChart(fDesde: string, fHasta: string) {
      const diasVentas: Record<string, number> = {};
      const diasGastos: Record<string, number> = {};
      const porLocal: Record<string, { ventas: number; gastos: number }> = {};
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (sucursal !== 'Todas' && r.local !== sucursal) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        diasVentas[r.fecha] = (diasVentas[r.fecha] ?? 0) + r.ventas;
        if (!porLocal[r.local]) porLocal[r.local] = { ventas: 0, gastos: 0 };
        porLocal[r.local].ventas += r.ventas;
      }
      for (const r of rawDiasGastos) {
        if (!r.fecha) continue;
        if (sucursal !== 'Todas' && r.sucursal !== sucursal) continue;
        if (fDesde && r.fecha < fDesde) continue;
        if (fHasta && r.fecha > fHasta) continue;
        diasGastos[r.fecha] = (diasGastos[r.fecha] ?? 0) + r.monto;
        if (r.sucursal) {
          if (!porLocal[r.sucursal]) porLocal[r.sucursal] = { ventas: 0, gastos: 0 };
          porLocal[r.sucursal].gastos += r.monto;
        }
      }
      const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
      const allDays = [...new Set([...Object.keys(diasVentas), ...Object.keys(diasGastos)])]
        .filter(d => { if (!ISO_RE.test(d)) return false; const [_y,_m,_day]=d.split('-').map(Number); return !isNaN(new Date(_y,_m-1,_day).getTime()); })
        .sort();
      let data: { fecha: string; ventas: number; gastos: number }[];
      if (allDays.length <= 31) {
        data = allDays.map(d => ({ fecha: formatDayLabel(d), ventas: diasVentas[d] ?? 0, gastos: diasGastos[d] ?? 0 }));
      } else {
        const porSemana: Record<string, { label: string; ventas: number; gastos: number }> = {};
        for (const d of allDays) {
          const lunes = getLunesSemana(d);
          if (!porSemana[lunes]) porSemana[lunes] = { label: formatWeekLabel(lunes), ventas: 0, gastos: 0 };
          porSemana[lunes].ventas += diasVentas[d] ?? 0;
          porSemana[lunes].gastos += diasGastos[d] ?? 0;
        }
        data = Object.entries(porSemana).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ fecha: v.label, ventas: v.ventas, gastos: v.gastos }));
      }
      return { data, porLocal };
    }

    // ── Helper: chart data para un rango de meses ────────────────────────────
    function buildMonthChart(mDesde: string, mHasta: string) {
      const locals = sucursal === 'Todas' ? Object.keys(rawLocalMes) : [sucursal];
      const meses = mesesDisponibles.filter(m => (!mDesde || m >= mDesde) && (!mHasta || m <= mHasta));
      const byMes: Record<string, { ventas: number; gastos: number }> = {};
      for (const local of locals) {
        for (const mes of meses) {
          const d = rawLocalMes[local]?.[mes];
          if (!d) continue;
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].ventas += d.ventas;
        }
      }
      if (sucursal === 'Todas') {
        for (const mes of meses) {
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].gastos = rawGastosMes[mes] ?? 0;
        }
      } else {
        // Usar gastosPorMesSucursal del server (basado en col 'mes' del sheet — más preciso)
        for (const mes of meses) {
          if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0 };
          byMes[mes].gastos = rawGastosMesSucursal[sucursal]?.[mes] ?? 0;
        }
      }
      return meses.map(m => ({ fecha: keyToLabel(m), ventas: byMes[m]?.ventas ?? 0, gastos: byMes[m]?.gastos ?? 0 }));
    }

    // ── Helper: fusiona período A y B alineados por índice ───────────────────
    function mergeWithComp(
      dataA: { fecha: string; ventas: number; gastos: number }[],
      dataB: { fecha: string; ventas: number; gastos: number }[],
    ): ChartRow[] {
      const maxLen = Math.max(dataA.length, dataB.length);
      return Array.from({ length: maxLen }, (_, i) => ({
        fecha:      dataA[i]?.fecha  ?? `+${i + 1}`,
        ventas:     dataA[i]?.ventas ?? 0,
        gastos:     dataA[i]?.gastos ?? 0,
        ventasComp: dataB[i]?.ventas,
        gastosComp: dataB[i]?.gastos,
        fechaComp:  dataB[i]?.fecha,
      }));
    }

    // ── Helper: top proveedores filtrado ─────────────────────────────────────
    function buildTopProveedores(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes') {
      const provMap: Record<string, number> = {};
      for (const r of rawDiasGastos) {
        if (!r.fecha || !r.proveedor) continue;
        if (sucursal !== 'Todas' && r.sucursal !== sucursal) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          const mes = r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
        provMap[r.proveedor] = (provMap[r.proveedor] ?? 0) + r.monto;
      }
      return Object.entries(provMap).sort(([, a], [, b]) => b - a).slice(0, 8).map(([nombre, monto]) => ({ nombre, monto }));
    }

    // ── Helper: transacciones (cierres de caja) filtrado ─────────────────────
    function buildTransacciones(fDesde: string, fHasta: string, mDesde: string, mHasta: string, modo: 'dia' | 'mes') {
      let count = 0;
      for (const r of rawDiasCaja) {
        if (!r.fecha) continue;
        if (sucursal !== 'Todas' && r.local !== sucursal) continue;
        if (modo === 'dia') {
          if (fDesde && r.fecha < fDesde) continue;
          if (fHasta && r.fecha > fHasta) continue;
        } else {
          const mes = r.fecha.slice(0, 7);
          if (mDesde && mes < mDesde) continue;
          if (mHasta && mes > mHasta) continue;
        }
        count++;
      }
      return count;
    }

    // ── Modo día/semana ───────────────────────────────────────────────────────
    if (modoFiltro === 'dia') {
      const { data: dataA, porLocal } = buildDayChart(fechaDesde, fechaHasta);
      let chartData: ChartRow[] = dataA;
      let totalVentasComp = 0, totalGastosComp = 0;
      if (compEnabled) {
        const { data: dataB } = buildDayChart(compFechaDesde, compFechaHasta);
        totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
        totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
        chartData = mergeWithComp(dataA, dataB);
      }
      const totalVentas = dataA.reduce((s, r) => s + r.ventas, 0);
      const totalGastos = dataA.reduce((s, r) => s + r.gastos, 0);
      const totalTransacciones = buildTransacciones(fechaDesde, fechaHasta, '', '', 'dia');
      const topProveedores = buildTopProveedores(fechaDesde, fechaHasta, '', '', 'dia');
      return { totalVentas, totalGastos, totalVentasComp, totalGastosComp, chartData, porLocalFiltrado: porLocal, hasComp: compEnabled, totalTransacciones, topProveedores };
    }

    // ── Modo mes ─────────────────────────────────────────────────────────────
    const dataA = buildMonthChart(mesDesde, mesHasta);
    let chartData: ChartRow[] = dataA;
    let totalVentasComp = 0, totalGastosComp = 0;
    if (compEnabled) {
      const dataB = buildMonthChart(compMesDesde, compMesHasta);
      totalVentasComp = dataB.reduce((s, r) => s + r.ventas, 0);
      totalGastosComp = dataB.reduce((s, r) => s + r.gastos, 0);
      chartData = mergeWithComp(dataA, dataB);
    }
    const totalVentas = dataA.reduce((s, r) => s + r.ventas, 0);
    const totalGastos = dataA.reduce((s, r) => s + r.gastos, 0);

    const mesesFiltrados = mesesDisponibles.filter(m => (!mesDesde || m >= mesDesde) && (!mesHasta || m <= mesHasta));
    const porLocalFiltrado: Record<string, { ventas: number; gastos: number }> = {};
    for (const local of Object.keys(rawLocalMes)) {
      for (const mes of mesesFiltrados) {
        const d = rawLocalMes[local]?.[mes];
        if (!d) continue;
        if (!porLocalFiltrado[local]) porLocalFiltrado[local] = { ventas: 0, gastos: 0 };
        porLocalFiltrado[local].ventas += d.ventas;
      }
    }
    // Gastos por sucursal — usar gastosPorMesSucursal del server (más preciso que filtrar por fecha.iso)
    for (const local of Object.keys(rawGastosMesSucursal)) {
      for (const mes of mesesFiltrados) {
        const g = rawGastosMesSucursal[local]?.[mes] ?? 0;
        if (!g) continue;
        if (!porLocalFiltrado[local]) porLocalFiltrado[local] = { ventas: 0, gastos: 0 };
        porLocalFiltrado[local].gastos += g;
      }
    }

    const totalTransacciones = buildTransacciones('', '', mesDesde, mesHasta, 'mes');
    const topProveedores = buildTopProveedores('', '', mesDesde, mesHasta, 'mes');
    return { totalVentas, totalGastos, totalVentasComp, totalGastosComp, chartData, porLocalFiltrado, hasComp: compEnabled, totalTransacciones, topProveedores };
  }, [rawLocalMes, rawGastosMes, rawGastosMesSucursal, rawDiasCaja, rawDiasGastos, sucursal,
      mesDesde, mesHasta, mesesDisponibles, fechaDesde, fechaHasta, modoFiltro,
      compEnabled, compMesDesde, compMesHasta, compFechaDesde, compFechaHasta]);

  const ventasReal = filteredData.totalVentas;
  const gastosReal = filteredData.totalGastos;
  const ventasComp = filteredData.totalVentasComp ?? 0;
  const gastosComp = filteredData.totalGastosComp ?? 0;
  const hasComp    = filteredData.hasComp ?? false;
  const margen = ventasReal > 0 ? (((ventasReal - gastosReal) / ventasReal) * 100).toFixed(1) : '0.0';
  const margenComp = ventasComp > 0 ? (((ventasComp - gastosComp) / ventasComp) * 100).toFixed(1) : null;
  const chartData = filteredData.chartData.length > 0 ? filteredData.chartData : rawData['30D'];
  const sucursalesDisponibles = ['Todas', ...Object.keys(rawLocalMes)];

  const handleExportChart = () => {
    exportToCSV(chartData.map(d => ({ Fecha: d.fecha, Ventas: d.ventas, Gastos: d.gastos })), 'ventas_gastos');
    toast('Datos del gráfico exportados');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 sticky top-0 z-30 transition-colors"
        style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="text-[18px] font-bold" style={{ color: 'var(--text)' }}>Ventas & Gastos</h1>
        <div className="flex items-center gap-3">
          {/* Filtro de fecha */}
          <div className="relative">
            <button
              onClick={() => setDateOpen(!dateOpen)}
              className={clsx(
                'flex items-center gap-2 border rounded-full px-3 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white',
                modoFiltro === 'dia' ? 'border-blue-400 text-blue-600' : 'border-gray-200'
              )}
            >
              <Calendar className={clsx('w-3.5 h-3.5', modoFiltro === 'dia' ? 'text-blue-500' : 'text-gray-400')} />
              {modoFiltro === 'dia'
                ? <span>{fechaDesde || '…'} – {fechaHasta || '…'}</span>
                : <span>{mesDesde ? keyToLabel(mesDesde) : '—'} – {mesHasta ? keyToLabel(mesHasta) : '—'}</span>
              }
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {dateOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-3 min-w-[280px]">
                {/* Tabs */}
                <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1 mb-3">
                  <button
                    onClick={() => setModoFiltro('mes')}
                    className={clsx('flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                      modoFiltro === 'mes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    Por mes
                  </button>
                  <button
                    onClick={() => setModoFiltro('dia')}
                    className={clsx('flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                      modoFiltro === 'dia' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    Día / semana
                  </button>
                </div>

                {modoFiltro === 'mes' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                      <select value={mesDesde} onChange={e => setMesDesde(e.target.value)}
                        className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
                        {mesesDisponibles.map(m => <option key={m} value={m}>{keyToLabel(m)}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                      <select value={mesHasta} onChange={e => setMesHasta(e.target.value)}
                        className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400">
                        {mesesDisponibles.map(m => <option key={m} value={m}>{keyToLabel(m)}</option>)}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                          className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                          className="w-full text-[12px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">≤ 31 días → vista diaria · &gt; 31 días → semanal</p>
                    {(fechaDesde || fechaHasta) && (
                      <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
                        className="mt-1.5 text-[10px] text-red-400 hover:text-red-600 font-semibold">
                        Limpiar fechas
                      </button>
                    )}
                  </div>
                )}

                {/* Comparación */}
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Comparar con</p>
                    <button
                      onClick={() => setCompEnabled(!compEnabled)}
                      className={clsx('relative w-8 h-4 rounded-full transition-colors',
                        compEnabled ? 'bg-blue-500' : 'bg-gray-300')}>
                      <span className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform',
                        compEnabled ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </div>
                  {compEnabled && (
                    modoFiltro === 'mes' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                          <select value={compMesDesde} onChange={e => setCompMesDesde(e.target.value)}
                            className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-blue-50/40">
                            <option value="">—</option>
                            {mesesDisponibles.map(m => <option key={m} value={m}>{keyToLabel(m)}</option>)}
                          </select>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                          <select value={compMesHasta} onChange={e => setCompMesHasta(e.target.value)}
                            className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-blue-50/40">
                            <option value="">—</option>
                            {mesesDisponibles.map(m => <option key={m} value={m}>{keyToLabel(m)}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Desde</p>
                          <input type="date" value={compFechaDesde} onChange={e => setCompFechaDesde(e.target.value)}
                            className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-blue-50/40" />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 mb-1">Hasta</p>
                          <input type="date" value={compFechaHasta} onChange={e => setCompFechaHasta(e.target.value)}
                            className="w-full text-[12px] border border-blue-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-blue-50/40" />
                        </div>
                      </div>
                    )
                  )}
                </div>

                <button onClick={() => setDateOpen(false)}
                  className="mt-3 w-full text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-1.5 transition-colors">
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Sucursal dropdown */}
          <div className="relative">
            <button
              onClick={() => setSucursalOpen(!sucursalOpen)}
              className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>{sucursal === 'Todas' ? 'Todas las sucursales' : sucursal}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {sucursalOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px]">
                {sucursalesDisponibles.map(s => (
                  <button key={s} onClick={() => { setSucursal(s); setSucursalOpen(false); }}
                    className={clsx('w-full text-left px-4 py-2.5 text-[12px] hover:bg-blue-50 transition-colors',
                      sucursal === s ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700')}>
                    {s === 'Todas' ? 'Todas las sucursales' : s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2 w-44">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input type="text" placeholder="Buscar..." className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400" />
          </div>
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-5 space-y-5 pb-8">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: 'Revenue Total', value: loadingSheet ? '...' : fmtFull(ventasReal),
              comp: hasComp && ventasComp > 0 ? fmtFull(ventasComp) : null,
              deltaPct: hasComp && ventasComp > 0 ? (((ventasReal - ventasComp) / ventasComp) * 100).toFixed(1) : null,
              icon: <DollarSign className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50',
            },
            {
              label: 'Gasto Total', value: loadingSheet ? '...' : fmtFull(gastosReal),
              comp: hasComp && gastosComp > 0 ? fmtFull(gastosComp) : null,
              deltaPct: hasComp && gastosComp > 0 ? (((gastosReal - gastosComp) / gastosComp) * 100).toFixed(1) : null,
              icon: <Receipt className="w-4 h-4 text-red-500" />, bg: 'bg-red-50',
            },
            {
              label: 'Margen Neto', value: `${margen}%`,
              comp: margenComp ? `${margenComp}%` : null,
              deltaPct: margenComp ? (parseFloat(margen) - parseFloat(margenComp)).toFixed(1) : null,
              icon: <BarChart2 className="w-4 h-4 text-green-600" />, bg: 'bg-green-50',
            },
            {
              label: 'Transacciones', value: loadingSheet ? '...' : filteredData.totalTransacciones.toLocaleString('es-CL'), comp: null, deltaPct: null,
              icon: <ShoppingCart className="w-4 h-4 text-purple-600" />, bg: 'bg-purple-50',
            },
          ].map(k => {
            const delta = k.deltaPct !== null ? parseFloat(k.deltaPct) : null;
            const pos = delta === null ? true : delta >= 0;
            return (
            <div key={k.label} className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{k.label}</p>
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', k.bg)}>{k.icon}</div>
              </div>
              <div className="flex items-end gap-2 mb-1">
                <p className="text-[22px] font-black text-gray-900 leading-none">{k.value}</p>
                {delta !== null && (
                  <span className={clsx('text-[11px] font-bold pb-0.5', pos ? 'text-green-600' : 'text-red-500')}>
                    {pos ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                    {pos ? '+' : ''}{k.deltaPct}%
                  </span>
                )}
              </div>
              {k.comp
                ? <p className="text-[10px] text-blue-500 font-medium">comp: {k.comp}</p>
                : <p className="text-[10px] text-gray-400">{hasComp ? 'sin datos comparativos' : 'Período seleccionado'}</p>
              }
            </div>
            );
          })}
        </div>

        {/* ── Gráfico interactivo ── */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          {/* Controles */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-gray-900 mr-2">Tendencia</h3>

              {/* Métrica */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                {(['ventas', 'gastos', 'ambos'] as Metrica[]).map(m => (
                  <button key={m} onClick={() => setMetrica(m)}
                    className={clsx('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize',
                      metrica === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                    {m === 'ambos' ? 'Comparar' : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              {/* Rango activo */}
              {mesDesde && mesHasta && (
                <span className="text-[11px] text-gray-500 bg-gray-100 rounded-xl px-3 py-1.5 font-medium">
                  {keyToLabel(mesDesde)}{mesDesde !== mesHasta ? ` – ${keyToLabel(mesHasta)}` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Tipo de gráfico */}
              <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                <button onClick={() => setTipoGrafico('area')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'area' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Área">
                  <Activity className={clsx('w-3.5 h-3.5', tipoGrafico === 'area' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
                <button onClick={() => setTipoGrafico('linea')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'linea' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Línea">
                  <TrendingUp className={clsx('w-3.5 h-3.5', tipoGrafico === 'linea' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
                <button onClick={() => setTipoGrafico('barras')}
                  className={clsx('p-1.5 rounded-lg transition-all', tipoGrafico === 'barras' ? 'bg-white shadow-sm' : 'hover:bg-white/60')}
                  title="Barras">
                  <LayoutGrid className={clsx('w-3.5 h-3.5', tipoGrafico === 'barras' ? 'text-blue-600' : 'text-gray-400')} />
                </button>
              </div>

              <button onClick={handleExportChart} className="flex items-center gap-1.5 text-[12px] text-blue-600 font-semibold hover:text-blue-800 transition-colors border border-blue-200 rounded-lg px-3 py-1.5">
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
            </div>
          </div>

          {/* Leyenda rápida */}
          <div className="flex items-center gap-4 mb-3">
            {(metrica === 'ventas' || metrica === 'ambos') && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Ventas
              </div>
            )}
            {(metrica === 'gastos' || metrica === 'ambos') && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-3 h-0.5 bg-red-500 inline-block rounded" />Gastos
              </div>
            )}
            <span className="text-[10px] text-gray-300">|</span>
            {modoFiltro === 'dia'
              ? <span className="text-[10px] text-blue-500 font-medium">{fechaDesde || '…'} → {fechaHasta || '…'} · {chartData.length} punto{chartData.length !== 1 ? 's' : ''}</span>
              : <span className="text-[10px] text-gray-400">{chartData.length} {chartData.length === 1 ? 'mes' : 'meses'}</span>
            }
          </div>

          <InteractiveChart data={chartData} metrica={metrica} tipo={tipoGrafico} hasComp={hasComp} />
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-3 gap-5">

          {/* Performance por Sucursal */}
          <div className="col-span-1 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Por Sucursal</h3>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Ventas</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Gastos</span>
              </div>
            </div>
            <div className="space-y-4">
              {(() => {
                const lista = Object.entries(filteredData.porLocalFiltrado).map(([nombre, d]) => ({ nombre, ...d }));
                if (!lista.length) return <p className="text-[11px] text-gray-400">Sin datos</p>;
                const maxV = Math.max(...lista.map(s => Math.max(s.ventas, s.gastos)), 1);
                return lista.map(s => (
                  <div key={s.nombre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold text-gray-700">{s.nombre}</span>
                      <span className="text-[11px] font-bold text-gray-500">{fmt(s.ventas)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(s.ventas / maxV) * 100}%` }} />
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${(s.gastos / maxV) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Top Proveedores (datos reales del Sheet) */}
          <div className="col-span-2 rounded-2xl p-5 shadow-sm" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Top Proveedores</h3>
              <button
                onClick={() => {
                  exportToCSV(filteredData.topProveedores.map((p, i) => ({
                    '#': i + 1, Proveedor: p.nombre, 'Monto CLP': p.monto,
                    '% del Total': gastosReal > 0 ? ((p.monto / gastosReal) * 100).toFixed(1) + '%' : '—',
                  })), 'top_proveedores');
                  toast('Top proveedores exportado');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors">
                <Download className="w-3 h-3" />CSV
              </button>
            </div>

            <div className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
              {['#', 'Proveedor', 'Monto', '%'].map(c => (
                <p key={c} className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">{c}</p>
              ))}
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {loadingSheet ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 py-2.5 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded w-4" />
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded w-8" />
                  </div>
                ))
              ) : filteredData.topProveedores.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-4 text-center">Sin datos para el período seleccionado</p>
              ) : (
                filteredData.topProveedores.map((p, i) => {
                  const pct = gastosReal > 0 ? ((p.monto / gastosReal) * 100).toFixed(1) : '0';
                  return (
                    <div key={p.nombre} className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 py-2.5 items-center hover:bg-gray-50/30 rounded-lg transition-colors">
                      <span className="text-[11px] font-bold text-gray-400">#{i + 1}</span>
                      <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre || '(sin nombre)'}</p>
                      <p className="text-[11px] font-bold text-red-500">{fmtFull(p.monto)}</p>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.min(parseFloat(pct), 100)}%` }} />
                        </div>
                        <span className="text-[9px] text-gray-400 w-6 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
