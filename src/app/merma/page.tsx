'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';

// --- Data ---
const categorias = [
  { nombre: 'Bakery (Panadería)', valor: 1850000, color: '#3B82F6', porcentaje: 43 },
  { nombre: 'Pastry (Pastelería)', valor: 1200000, color: '#8B5CF6', porcentaje: 28 },
  { nombre: 'Cafe (Bebidas/Café)', valor: 800000, color: '#06B6D4', porcentaje: 19 },
  { nombre: 'Otros', valor: 400000, color: '#D1D5DB', porcentaje: 10 },
];

const motivosData = [
  { name: 'Expirado', value: 45, color: '#EF4444' },
  { name: 'Dañado', value: 25, color: '#F97316' },
  { name: 'Calidad', value: 20, color: '#EAB308' },
  { name: 'Producción', value: 10, color: '#D1D5DB' },
];

const sparklineData = [
  { v: 0.8 }, { v: 1.1 }, { v: 0.9 }, { v: 1.0 }, { v: 1.2 }, { v: 1.4 }, { v: 1.5 },
];

const registros = [
  { id: 1, timestamp: 'Hoy, 10:45 AM', producto: 'Croissant Mantequilla', categoria: 'Bakery', cantidad: 12, motivo: 'Expirado', costo: 48000 },
  { id: 2, timestamp: 'Hoy, 08:30 AM', producto: 'Latte Macchiato XL', categoria: 'Cafe', cantidad: 2, motivo: 'Calidad', costo: 14500 },
  { id: 3, timestamp: 'Ayer, 06:15 PM', producto: 'Tarta de Queso', categoria: 'Pastry', cantidad: 1, motivo: 'Dañado', costo: 25000 },
  { id: 4, timestamp: 'Ayer, 11:20 AM', producto: 'Pan Artesanal', categoria: 'Bakery', cantidad: 8, motivo: 'Expirado', costo: 64000 },
  { id: 5, timestamp: 'Ayer, 09:00 AM', producto: 'Muffin Arándanos', categoria: 'Pastry', cantidad: 6, motivo: 'Calidad', costo: 18000 },
];

const PERIODOS = ['Últimos 7 días', 'Últimos 14 días', 'Este mes', 'Mes anterior'];

const motivoBadge: Record<string, string> = {
  Expirado: 'bg-red-100 text-red-600',
  Calidad: 'bg-orange-100 text-orange-600',
  Dañado: 'bg-gray-100 text-gray-600',
  Producción: 'bg-yellow-100 text-yellow-700',
};

// --- Custom Donut Label ---
const DonutCenter = ({ cx, cy }: any) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
    <tspan x={cx} dy="-6" fontSize="22" fontWeight="800" fill="#111827">100%</tspan>
    <tspan x={cx} dy="18" fontSize="10" fill="#9CA3AF">TOTAL</tspan>
  </text>
);

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

// --- Tipos para datos reales ---
type SheetMermaKPI = { totalMerma: number; totalRegistros: number; tipoMasFrecuente: string };
type SheetMermaTipo = { nombre: string; monto: number; porcentaje: number; color: string };
type SheetMermaRegistro = { id: number; producto: string; tipo: string; monto: number; fecha: string };

// --- Main Page ---
export default function MermaPage() {
  const [periodo, setPeriodo] = useState('Últimos 7 días');
  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // ── Datos reales desde Google Sheets ──────────────────
  const [sheetKPI, setSheetKPI] = useState<SheetMermaKPI | null>(null);
  const [sheetTipos, setSheetTipos] = useState<SheetMermaTipo[]>([]);
  const [sheetRegistros, setSheetRegistros] = useState<SheetMermaRegistro[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(true);

  useEffect(() => {
    fetch('/api/merma-data')
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setSheetKPI(data.kpi);
          setSheetTipos(data.porTipo ?? []);
          setSheetRegistros(data.ultimosRegistros ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSheet(false));
  }, []);

  // Usa datos reales si están disponibles, mock si no
  const categoriasActivas = sheetTipos.length > 0
    ? sheetTipos.map(t => ({ nombre: t.nombre, valor: t.monto, color: t.color, porcentaje: t.porcentaje }))
    : categorias;
  const maxCategoria = Math.max(...categoriasActivas.map((c) => c.valor), 1);

  // Registros para la tabla
  const registrosSheet = sheetRegistros.length > 0
    ? sheetRegistros.map(r => ({
        id: r.id,
        timestamp: r.fecha,
        producto: r.producto,
        categoria: r.tipo,
        cantidad: 1,
        motivo: r.tipo,
        costo: r.monto,
      }))
    : registros;

  const registrosVisibles = showAll ? registrosSheet : registrosSheet.slice(0, 4);

  const handleCSV = () => {
    exportToCSV(
      registrosSheet.map(r => ({
        Fecha: r.timestamp,
        Producto: r.producto,
        Tipo: r.categoria,
        'Monto CLP': r.costo,
      })),
      'merma_registros'
    );
    toast('Registros de merma exportados');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-gray-50 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
        <h1 className="text-[18px] font-bold text-gray-900">Dashboard de Merma</h1>
        <div className="flex items-center gap-3 flex-1 max-w-xs mx-6">
          <div className="flex items-center gap-2 w-full bg-gray-100 rounded-full px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
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
            <p className="text-[11px] text-gray-400">Mes actual vs anterior</p>
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
              <p className="text-[30px] font-black text-gray-900 leading-none">2.8%</p>
              <span className="text-[12px] font-bold text-green-600 flex items-center gap-0.5 pb-1">
                <TrendingDown className="w-3 h-3" />-0.2%
              </span>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex-1 bg-gray-100 rounded-full h-2 mr-3">
                <div className="h-2 rounded-full bg-green-500" style={{ width: '56%' }} />
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
              <div className="relative">
                <button
                  onClick={() => setPeriodoOpen(!periodoOpen)}
                  className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:border-blue-400 transition-colors"
                >
                  {periodo}
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                {periodoOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20 min-w-[150px]">
                    {PERIODOS.map((p) => (
                      <button
                        key={p}
                        onClick={() => { setPeriodo(p); setPeriodoOpen(false); }}
                        className={clsx(
                          'w-full text-left px-4 py-2.5 text-[12px] hover:bg-blue-50 transition-colors',
                          periodo === p ? 'text-blue-600 font-semibold' : 'text-gray-700'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {categoriasActivas.map((cat) => (
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
              ))}
            </div>
          </div>

          {/* Merma por Motivo */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-gray-900">Merma por Motivo</h3>
              <button className="text-[12px] font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                Ver detalles
              </button>
            </div>

            <div className="flex items-center gap-6">
              {/* Donut */}
              <div className="relative w-44 h-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={motivosData}
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
                      {motivosData.map((entry, i) => (
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
                {motivosData.map((m) => (
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
          </div>
        </div>

        {/* Registros Recientes */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[14px] font-bold text-gray-900">Registros de Merma Recientes</h3>
            <button onClick={handleCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[12px] font-semibold transition-colors shadow-sm">
              <Download className="w-3.5 h-3.5" />
              Descargar CSV
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-6 gap-3 pb-3 border-b border-gray-100">
            {['Timestamp', 'Producto', 'Categoría', 'Cantidad', 'Motivo', 'Costo Est.'].map((col) => (
              <p key={col} className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                {col}
              </p>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {registrosVisibles.map((r) => (
              <div key={r.id} className="grid grid-cols-6 gap-3 py-3.5 items-center hover:bg-gray-50/50 rounded-lg transition-colors">
                <p className="text-[12px] text-gray-400">{r.timestamp}</p>
                <p className="text-[12px] font-semibold text-gray-800">{r.producto}</p>
                <p className="text-[12px] text-gray-600">{r.categoria}</p>
                <p className="text-[12px] font-semibold text-gray-700">{r.cantidad} u</p>
                <span className={clsx('text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit', motivoBadge[r.motivo] ?? 'bg-gray-100 text-gray-600')}>
                  {r.motivo}
                </span>
                <p className="text-[12px] font-bold text-gray-800">${r.costo.toLocaleString('es-CL')}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-100 text-center">
            <button onClick={() => setShowAll(v => !v)} className="text-[12px] text-blue-600 font-semibold hover:text-blue-800 transition-colors">
              {showAll ? 'Ver menos' : 'Ver todos los registros'}
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
