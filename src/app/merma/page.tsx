'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toLocalDate } from '@/lib/date-utils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  Search,
  Bell,
  Download,
  Plus,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Percent,
  MapPin,
  CalendarDays,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';

// --- Data mock (fallback) ---
const categoriasMock = [
  { nombre: 'Bakery (Panadería)', valor: 1850000, color: '#3B82F6', porcentaje: 43 },
  { nombre: 'Pastry (Pastelería)', valor: 1200000, color: '#8B5CF6', porcentaje: 28 },
  { nombre: 'Cafe (Bebidas/Café)', valor: 800000, color: '#06B6D4', porcentaje: 19 },
  { nombre: 'Otros', valor: 400000, color: '#D1D5DB', porcentaje: 10 },
];


const sparklineData = [
  { v: 0.8 }, { v: 1.1 }, { v: 0.9 }, { v: 1.0 }, { v: 1.2 }, { v: 1.4 }, { v: 1.5 },
];

const registrosMock = [
  { id: 1, timestamp: 'Hoy, 10:45 AM', producto: 'Croissant Mantequilla', categoria: 'Bakery', cantidad: 12, motivo: 'Expirado', costo: 48000, local: '' },
  { id: 2, timestamp: 'Hoy, 08:30 AM', producto: 'Latte Macchiato XL', categoria: 'Cafe', cantidad: 2, motivo: 'Calidad', costo: 14500, local: '' },
  { id: 3, timestamp: 'Ayer, 06:15 PM', producto: 'Tarta de Queso', categoria: 'Pastry', cantidad: 1, motivo: 'Dañado', costo: 25000, local: '' },
  { id: 4, timestamp: 'Ayer, 11:20 AM', producto: 'Pan Artesanal', categoria: 'Bakery', cantidad: 8, motivo: 'Expirado', costo: 64000, local: '' },
  { id: 5, timestamp: 'Ayer, 09:00 AM', producto: 'Muffin Arándanos', categoria: 'Pastry', cantidad: 6, motivo: 'Calidad', costo: 18000, local: '' },
];

// Periodos disponibles con sus códigos para la API
const PERIODOS = [
  { label: 'Todos los períodos', value: '' },
  { label: 'Últimos 7 días', value: '7d' },
  { label: 'Últimos 14 días', value: '14d' },
  { label: 'Este mes', value: 'mes' },
  { label: 'Mes anterior', value: 'mes_anterior' },
  { label: 'Este año', value: 'anio' },
];

const TIPO_BADGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
];

// --- Types ---
type SheetMermaKPI = { totalMerma: number; totalRegistros: number; tipoMasFrecuente: string; montoMayor: number };
type SheetMermaTipo = { nombre: string; monto: number; porcentaje: number; color: string };
type SheetMermaRegistro = { id: number; producto: string; tipo: string; monto: number; fecha: string; local?: string };
type CierreCajaLocal = { ventas: number; efectivo: number; tarjeta: number; transf: number };
type CierreCajaData = {
  ok: boolean;
  porLocal: Record<string, CierreCajaLocal>;
  porLocalMes: Record<string, Record<string, CierreCajaLocal>>;
};

/**
 * Retorna las claves YYYY-MM relevantes para el período/rango activo.
 * Array vacío = sin filtro = usar totales acumulados.
 */
function getMesesPeriodo(periodo: string, fechaDesde: string, fechaHasta: string): string[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const mesKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  if (fechaDesde || fechaHasta) {
    const desde = fechaDesde ? toLocalDate(fechaDesde) : null;
    const hasta  = fechaHasta  ? toLocalDate(fechaHasta)  : null;
    const start = desde ?? hasta!;
    const end   = hasta  ?? desde!;
    const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
    const meses: string[] = [];
    while (cur <= end) {
      meses.push(mesKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    return meses;
  }

  switch (periodo) {
    case 'mes': return [mesKey(now)];
    case 'mes_anterior': return [mesKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))];
    case 'anio':  return Array.from({ length: now.getMonth() + 1 }, (_, i) => `${now.getFullYear()}-${pad(i + 1)}`);
    case '7d':
    case '14d': {
      const dias = periodo === '7d' ? 6 : 13;
      const inicio = new Date(now); inicio.setDate(now.getDate() - dias);
      const meses = new Set([mesKey(inicio), mesKey(now)]);
      return [...meses];
    }
    default: return []; // sin filtro → totales acumulados
  }
}

// --- Modal: Registrar Merma ---
function RegistrarMermaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-[16px] font-bold text-gray-900 mb-5">Registrar Nueva Merma</h2>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Producto</label>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors" placeholder="Nombre del producto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Categoría</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors bg-white">
                <option>Bakery</option>
                <option>Pastry</option>
                <option>Cafe</option>
                <option>Otros</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Motivo</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors bg-white">
                <option>Expirado</option>
                <option>Dañado</option>
                <option>Calidad</option>
                <option>Producción</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Cantidad (u)</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors" placeholder="0" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Costo Estimado ($)</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
            Guardar Registro
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Dropdown genérico ---
function FilterDropdown({
  icon,
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-2 border rounded-full px-3.5 py-2 text-[12px] font-medium transition-all',
          value
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400',
        )}
      >
        <span className="text-current opacity-70">{icon}</span>
        <span>{selected?.label ?? placeholder ?? label}</span>
        <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
      </button>

      {open && (
        <>
          {/* overlay */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-20 min-w-[180px]">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={clsx(
                  'w-full text-left px-4 py-2.5 text-[12px] hover:bg-blue-50 transition-colors flex items-center justify-between gap-3',
                  value === opt.value ? 'text-blue-600 font-semibold bg-blue-50/60' : 'text-gray-700',
                )}
              >
                {opt.label}
                {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Main Page ---
export default function MermaPage() {
  const [showModal, setShowModal] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [periodo, setPeriodo] = useState('');          // '' = todos
  const [localFiltro, setLocalFiltro] = useState('');  // '' = todos
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Datos desde Google Sheets ─────────────────────────────────────────────
  const [sheetKPI, setSheetKPI] = useState<SheetMermaKPI | null>(null);
  const [sheetTipos, setSheetTipos] = useState<SheetMermaTipo[]>([]);
  const [sheetRegistros, setSheetRegistros] = useState<SheetMermaRegistro[]>([]);
  const [localesDisponibles, setLocalesDisponibles] = useState<string[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(true);
  const [ccData, setCcData] = useState<CierreCajaData | null>(null);

  const fetchData = useCallback(() => {
    setLoadingSheet(true);
    const params = new URLSearchParams();
    if (localFiltro) params.set('local', localFiltro);
    if (periodo)     params.set('periodo', periodo);
    if (fechaDesde)  params.set('fechaDesde', fechaDesde);
    if (fechaHasta)  params.set('fechaHasta', fechaHasta);

    const url = `/api/merma-data${params.size > 0 ? '?' + params.toString() : ''}`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setSheetKPI(data.kpi);
          setSheetTipos(data.porTipo ?? []);
          setSheetRegistros(data.ultimosRegistros ?? []);
          if (data.locales?.length > 1) setLocalesDisponibles(data.locales);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSheet(false));
  }, [localFiltro, periodo, fechaDesde, fechaHasta]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cierre-caja: se carga una sola vez (tiene todos los meses y locales)
  useEffect(() => {
    fetch('/api/cierre-caja')
      .then(r => r.json())
      .then(data => { if (data.ok) setCcData(data); })
      .catch(() => {});
  }, []);

  // Opciones para los dropdowns
  const periodoOpts = PERIODOS;
  const localOpts = localesDisponibles.length > 0
    ? [
        { label: 'Todos los locales', value: '' },
        ...localesDisponibles.filter(l => l !== 'Todos').map(l => ({ label: l, value: l })),
      ]
    : [{ label: 'Todos los locales', value: '' }];

  // Número de filtros activos
  const filtrosActivos = [localFiltro, periodo, fechaDesde, fechaHasta].filter(Boolean).length;

  const clearFiltros = () => {
    setPeriodo('');
    setLocalFiltro('');
    setFechaDesde('');
    setFechaHasta('');
    setShowDatePicker(false);
  };

  // ── % Merma vs Ventas (fórmula: totalMerma / totalVentas × 100) ──────────
  const porcentajeMerma = useMemo(() => {
    if (!sheetKPI || !ccData?.porLocal) return null;
    const { porLocal, porLocalMes } = ccData;
    const meses = getMesesPeriodo(periodo, fechaDesde, fechaHasta);
    const locales = localFiltro
      ? [localFiltro]
      : Object.keys(porLocal);

    let totalVentas = 0;
    if (meses.length === 0) {
      // Sin filtro de período → usar ventas acumuladas totales
      for (const local of locales) totalVentas += porLocal[local]?.ventas ?? 0;
    } else {
      for (const local of locales) {
        for (const mes of meses) totalVentas += porLocalMes[local]?.[mes]?.ventas ?? 0;
      }
    }
    if (totalVentas === 0) return null;
    return (sheetKPI.totalMerma / totalVentas) * 100;
  }, [sheetKPI, ccData, periodo, fechaDesde, fechaHasta, localFiltro]);

  // ── Datos para UI ────────────────────────────────────────────────────────
  const categoriasActivas = sheetTipos.length > 0
    ? sheetTipos.map(t => ({ nombre: t.nombre, valor: t.monto, color: t.color, porcentaje: t.porcentaje }))
    : categoriasMock;
  const maxCategoria = Math.max(...categoriasActivas.map(c => c.valor), 1);

  // Donut "Merma por Tipo" — usa los mismos datos reales que el panel de categorías
  const motivosDonutData = categoriasActivas.map(c => ({ name: c.nombre, value: c.porcentaje, color: c.color }));

  const registrosSheet = sheetRegistros.length > 0
    ? sheetRegistros.map(r => ({
        id: r.id,
        timestamp: r.fecha,
        producto: r.producto,
        categoria: r.tipo,
        cantidad: 1,
        motivo: r.tipo,
        costo: r.monto,
        local: r.local ?? '',
      }))
    : registrosMock;

  // Filtramos por búsqueda local (client-side)
  const registrosFiltrados = registrosSheet.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.producto.toLowerCase().includes(q) ||
      r.categoria.toLowerCase().includes(q) ||
      r.motivo.toLowerCase().includes(q) ||
      r.local.toLowerCase().includes(q)
    );
  });

  const registrosVisibles = showAll ? registrosFiltrados : registrosFiltrados.slice(0, 4);

  const handleCSV = () => {
    exportToCSV(
      registrosFiltrados.map(r => ({
        Fecha: r.timestamp,
        Producto: r.producto,
        Tipo: r.categoria,
        'Monto CLP': r.costo,
        Local: r.local,
      })),
      'merma_registros'
    );
    toast('Registros de merma exportados');
  };

  // Label para el filtro de período activo
  const periodoLabel = PERIODOS.find(p => p.value === periodo)?.label ?? 'Todos los períodos';

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-gray-50 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
        <h1 className="text-[18px] font-bold text-gray-900">Dashboard de Merma</h1>
        <div className="flex items-center gap-2 flex-1 max-w-xs mx-6">
          <div className="flex items-center gap-2 w-full bg-gray-100 rounded-full px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar producto o registro..."
              className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400"
            />
          </div>
        </div>
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </header>

      {/* ── Barra de Filtros ───────────────────────────────────────────────── */}
      <div className="sticky top-[61px] z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Filtrar:</span>

          {/* Filtro por período */}
          <FilterDropdown
            icon={<CalendarDays className="w-3.5 h-3.5" />}
            label="Período"
            value={periodo}
            options={periodoOpts}
            onChange={v => { setPeriodo(v); if (v) { setFechaDesde(''); setFechaHasta(''); setShowDatePicker(false); } }}
            placeholder="Todos los períodos"
          />

          {/* Filtro por local */}
          {localOpts.length > 1 && (
            <FilterDropdown
              icon={<MapPin className="w-3.5 h-3.5" />}
              label="Local"
              value={localFiltro}
              options={localOpts}
              onChange={setLocalFiltro}
              placeholder="Todos los locales"
            />
          )}

          {/* Rango de fechas personalizado */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(o => !o)}
              className={clsx(
                'flex items-center gap-2 border rounded-full px-3.5 py-2 text-[12px] font-medium transition-all',
                (fechaDesde || fechaHasta)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400',
              )}
            >
              <CalendarDays className="w-3.5 h-3.5 opacity-70" />
              {fechaDesde || fechaHasta
                ? `${fechaDesde || '...'} → ${fechaHasta || '...'}`
                : 'Rango personalizado'}
              <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
            </button>

            {showDatePicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-4 min-w-[280px]">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-3">Rango de fechas</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Desde</label>
                      <input
                        type="date"
                        value={fechaDesde}
                        onChange={e => { setFechaDesde(e.target.value); setPeriodo(''); }}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-blue-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-semibold mb-1 block">Hasta</label>
                      <input
                        type="date"
                        value={fechaHasta}
                        onChange={e => { setFechaHasta(e.target.value); setPeriodo(''); }}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-blue-400 transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[12px] font-semibold transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Indicador de filtros activos + limpiar */}
          {filtrosActivos > 0 && (
            <button
              onClick={clearFiltros}
              className="flex items-center gap-1.5 ml-1 text-[12px] font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar filtros
              <span className="bg-red-100 text-red-600 rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                {filtrosActivos}
              </span>
            </button>
          )}

          {/* Indicador de carga */}
          {loadingSheet && (
            <span className="ml-auto text-[11px] text-gray-400 animate-pulse">Actualizando...</span>
          )}

          {/* Resumen del filtro activo */}
          {!loadingSheet && sheetKPI && (
            <span className="ml-auto text-[11px] text-gray-500 font-medium">
              {sheetKPI.totalRegistros} registro{sheetKPI.totalRegistros !== 1 ? 's' : ''}
              {filtrosActivos > 0 ? ` · ${periodoLabel}` : ''}
              {localFiltro ? ` · ${localFiltro}` : ''}
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 px-6 py-5 space-y-5 pb-24">

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-5">

          {/* Costo Total */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Costo Total de Merma</p>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="flex items-end gap-2 mb-1">
              <p className="text-[30px] font-black text-gray-900 leading-none">
                {loadingSheet ? '...' : sheetKPI ? `$${sheetKPI.totalMerma.toLocaleString('es-CL')}` : '$4.250.000'}
              </p>
              <span className="text-[12px] font-bold text-red-500 flex items-center gap-0.5 pb-1">
                <TrendingDown className="w-3 h-3" />-5.2%
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              {filtrosActivos > 0 ? `${sheetKPI?.totalRegistros ?? '—'} registros filtrados` : 'Mes actual vs anterior'}
            </p>
          </div>

          {/* % Merma vs Ventas */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">% Merma vs Ventas</p>
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                <Percent className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <p className="text-[30px] font-black text-gray-900 leading-none">
                {loadingSheet || !ccData ? '...' : porcentajeMerma !== null ? porcentajeMerma.toFixed(2) + '%' : '—'}
              </p>
              {porcentajeMerma !== null && (
                <span className={`text-[12px] font-bold flex items-center gap-0.5 pb-1 ${porcentajeMerma <= 3 ? 'text-green-600' : 'text-red-500'}`}>
                  {porcentajeMerma <= 3 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {porcentajeMerma <= 3 ? 'OK' : 'Alto'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex-1 bg-gray-100 rounded-full h-2 mr-3">
                <div
                  className={`h-2 rounded-full transition-all ${porcentajeMerma !== null && porcentajeMerma > 3 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: porcentajeMerma !== null ? `${Math.min((porcentajeMerma / 3) * 100, 100)}%` : '0%' }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Target &lt;3%</span>
            </div>
          </div>

          {/* Tendencia Semanal */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">Tendencia Semanal</p>
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-[30px] font-black text-gray-900 leading-none">+1.5%</p>
                </div>
                <p className="text-[11px] text-gray-400">Desde el Lunes</p>
              </div>
              {/* Sparkline */}
              <div className="w-28 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sparklineData} barSize={10}>
                    <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                      {sparklineData.map((_, i) => (
                        <Cell key={i} fill={i === sparklineData.length - 1 ? '#3B82F6' : '#DBEAFE'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-2 gap-5">

          {/* Merma por Categoría */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[14px] font-bold text-gray-900">Merma por Categoría</h3>
              {/* Badge de filtros activos */}
              {filtrosActivos > 0 && (
                <span className="text-[10px] font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {periodoLabel}
                  {localFiltro ? ` · ${localFiltro}` : ''}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {loadingSheet ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="animate-pulse">
                      <div className="flex justify-between mb-1.5">
                        <div className="h-3 bg-gray-100 rounded w-32" />
                        <div className="h-3 bg-gray-100 rounded w-20" />
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5" />
                    </div>
                  ))}
                </div>
              ) : categoriasActivas.length === 0 ? (
                <p className="text-[12px] text-gray-400 text-center py-6">Sin datos para el filtro seleccionado</p>
              ) : (
                categoriasActivas.map((cat) => (
                  <div key={cat.nombre}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] text-gray-700 font-medium">{cat.nombre}</span>
                      <span className="text-[12px] font-bold text-gray-800">${cat.valor.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${(cat.valor / maxCategoria) * 100}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Merma por Tipo */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-gray-900">Merma por Tipo</h3>
              {filtrosActivos > 0 && (
                <span className="text-[10px] font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
                  {periodoLabel}{localFiltro ? ` · ${localFiltro}` : ''}
                </span>
              )}
            </div>

            {loadingSheet ? (
              <div className="flex items-center justify-center h-44">
                <div className="w-24 h-24 rounded-full border-4 border-gray-100 animate-pulse" />
              </div>
            ) : motivosDonutData.length === 0 ? (
              <p className="text-[12px] text-gray-400 text-center py-10">Sin datos</p>
            ) : (
              <div className="flex items-center gap-6">
                {/* Donut */}
                <div className="relative w-44 h-44 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={motivosDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={2}
                        stroke="#fff"
                      >
                        {motivosDonutData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}%`, '']}
                        contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e5e7eb' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[20px] font-black text-gray-900 leading-none">100%</p>
                    <p className="text-[9px] text-gray-400 font-medium tracking-widest uppercase mt-0.5">TOTAL</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-3">
                  {motivosDonutData.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-[12px] text-gray-600">{m.name}</span>
                      </div>
                      <span className="text-[12px] font-bold text-gray-800">{m.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Registros Recientes */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[14px] font-bold text-gray-900">Registros de Merma</h3>
              {filtrosActivos > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Mostrando {registrosFiltrados.length} resultado{registrosFiltrados.length !== 1 ? 's' : ''}
                  {localFiltro ? ` · ${localFiltro}` : ''}
                  {periodo ? ` · ${periodoLabel}` : ''}
                </p>
              )}
            </div>
            <button onClick={handleCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[12px] font-semibold transition-colors shadow-sm">
              <Download className="w-3.5 h-3.5" />
              Descargar CSV
            </button>
          </div>

          {/* Table header */}
          <div className={clsx(
            'pb-3 border-b border-gray-100 grid gap-3',
            localesDisponibles.length > 1 ? 'grid-cols-7' : 'grid-cols-6'
          )}>
            {['Timestamp', 'Producto', 'Categoría', ...(localesDisponibles.length > 1 ? ['Local'] : []), 'Cantidad', 'Motivo', 'Costo Est.'].map((col) => (
              <p key={col} className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                {col}
              </p>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {loadingSheet ? (
              [1,2,3,4].map(i => (
                <div key={i} className={clsx('py-3.5 grid gap-3 animate-pulse', localesDisponibles.length > 1 ? 'grid-cols-7' : 'grid-cols-6')}>
                  {Array.from({ length: localesDisponibles.length > 1 ? 7 : 6 }).map((_, j) => (
                    <div key={j} className="h-3 bg-gray-100 rounded" />
                  ))}
                </div>
              ))
            ) : registrosVisibles.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-gray-400">No hay registros para el filtro seleccionado.</p>
              </div>
            ) : (
              registrosVisibles.map((r) => (
                <div key={r.id} className={clsx(
                  'py-3.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors grid gap-3',
                  localesDisponibles.length > 1 ? 'grid-cols-7' : 'grid-cols-6'
                )}>
                  <p className="text-[12px] text-gray-400">{r.timestamp}</p>
                  <p className="text-[12px] font-semibold text-gray-800">{r.producto}</p>
                  <p className="text-[12px] text-gray-600">{r.categoria}</p>
                  {localesDisponibles.length > 1 && (
                    <p className="text-[12px] text-gray-500">{r.local || '—'}</p>
                  )}
                  <p className="text-[12px] font-semibold text-gray-700">{r.cantidad} u</p>
                  <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit', TIPO_BADGE_COLORS[categoriasActivas.findIndex(c => c.nombre === r.motivo) % TIPO_BADGE_COLORS.length] ?? 'bg-gray-100 text-gray-600')}>
                    {r.motivo}
                  </span>
                  <p className="text-[12px] font-bold text-gray-800">${r.costo.toLocaleString('es-CL')}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 text-center">
            <button onClick={() => setShowAll(v => !v)} className="text-[12px] text-blue-600 font-semibold hover:text-blue-800 transition-colors">
              {showAll ? 'Ver menos' : `Ver todos los registros (${registrosFiltrados.length})`}
            </button>
          </div>
        </div>
      </main>

      {/* FAB: Registrar Merma */}
      <div className="fixed bottom-6 left-[212px] z-40">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[13px] font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          Registrar Merma
        </button>
      </div>

      {/* Modal */}
      {showModal && <RegistrarMermaModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
