'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Download,
  Search,
  Bell,
  Settings,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { exportToCSV } from '@/lib/csv-export';
import { toast } from '@/components/ui/Toast';

// --- Data ---
const trendData = [
  { dia: 'LUN', eficiente: 44, riesgo: 44 },
  { dia: 'MAR', eficiente: 42, riesgo: 46 },
  { dia: 'MIE', eficiente: 40, riesgo: 43 },
  { dia: 'JUE', eficiente: 43, riesgo: 48 },
  { dia: 'VIE', eficiente: 46, riesgo: 57 },
  { dia: 'SAB', eficiente: 48, riesgo: 62 },
  { dia: 'DOM', eficiente: 45, riesgo: 51 },
];

const alertas = [
  {
    id: 1,
    tipo: 'critical',
    titulo: 'Pico Crítico',
    tiempo: 'Hoy, 10:45 AM',
    mensaje: 'Índice alcanzó 62.4% en sucursal PV. Spike causado por mantenimiento no planificado y bajo volumen de transacciones.',
    acknowledged: false,
  },
  {
    id: 2,
    tipo: 'warning',
    titulo: 'Alerta de Merma',
    tiempo: 'Ayer',
    mensaje: 'La merma en La Reina subió un 15%. Se proyecta que empuje el índice semanal sobre 50% si no se corrige.',
    acknowledged: false,
  },
  {
    id: 3,
    tipo: 'info',
    titulo: 'Alerta de Eficiencia',
    tiempo: 'Hace 2 días',
    mensaje: 'PT está en 48.2%. Mantiene tendencia positiva pero requiere monitoreo durante fin de semana.',
    acknowledged: true,
  },
];

const SUCURSALES = ['Todas las sucursales', 'PV', 'La Reina', 'PT', 'Bilbao'];

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-[12px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-bold text-gray-800">{entry.value}%</span>
          </div>
        ))}
        <div className="border-t border-gray-100 mt-2 pt-2">
          <p className="text-[10px] text-gray-400">Umbral objetivo: 50%</p>
        </div>
      </div>
    );
  }
  return null;
};

// --- Main Page ---
export default function FactorIndicePage() {
  const [sucursal, setSucursal] = useState('Todas las sucursales');
  const [sucursalOpen, setSucursalOpen] = useState(false);
  const [alertList, setAlertList] = useState(alertas);
  const [factorActual] = useState(48.2);
  const [showMetricas, setShowMetricas] = useState(false);
  const isOptimizado = factorActual < 50;

  const activeCount = alertList.filter((a) => !a.acknowledged).length;

  const acknowledge = (id: number) => {
    setAlertList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  const dismiss = (id: number) => {
    setAlertList((prev) => prev.filter((a) => a.id !== id));
  };

  const handleExport = () => {
    exportToCSV(
      trendData.map(d => ({
        Día: d.dia,
        'Factor Eficiente (%)': d.eficiente,
        'Factor Riesgo (%)': d.riesgo,
      })),
      'factor_indice_tendencia'
    );
    toast('Reporte exportado correctamente');
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
        <h1 className="text-[18px] font-bold text-gray-900">Factor Índice Overview</h1>

        <div className="flex items-center gap-3 flex-1 max-w-xs mx-6">
          <div className="flex items-center gap-2 w-full bg-gray-100 rounded-full px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar datos..."
              className="bg-transparent text-[12px] text-gray-600 outline-none w-full placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Bell className="w-4 h-4" />
            {activeCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Subheader filters */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Week selector */}
          <button className="flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white">
            <span className="text-gray-400 font-medium">Semana:</span>
            <span className="font-semibold">Actual (Jun 24-30)</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {/* Branch selector */}
          <div className="relative">
            <button
              onClick={() => setSucursalOpen(!sucursalOpen)}
              className="flex items-center gap-2 border border-gray-200 rounded-full px-4 py-2 text-[12px] text-gray-700 hover:border-blue-400 transition-colors bg-white"
            >
              <span className="text-gray-400 font-medium">Sucursal:</span>
              <span className="font-semibold">{sucursal === 'Todas las sucursales' ? 'Todas' : sucursal}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>
            {sucursalOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px]">
                {SUCURSALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSucursal(s); setSucursalOpen(false); }}
                    className={clsx(
                      'w-full text-left px-4 py-2.5 text-[12px] hover:bg-blue-50 transition-colors',
                      sucursal === s ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[12px] font-semibold transition-colors shadow-sm">
          <Download className="w-3.5 h-3.5" />
          Exportar Reporte
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 py-5 space-y-5">

        {/* Top Row */}
        <div className="grid grid-cols-3 gap-5">

          {/* Factor Índice Actual */}
          <div className="col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-green-400 text-green-600 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isOptimizado ? 'OPTIMIZADO' : 'EN RIESGO'}
              </div>

              <div>
                <p className="text-[12px] text-gray-500 font-medium mb-2">Factor Índice Actual</p>
                <div className="flex items-end gap-3">
                  <p className={clsx('text-[52px] font-black leading-none', isOptimizado ? 'text-gray-900' : 'text-red-600')}>
                    {factorActual}%
                  </p>
                  <div className="flex items-center gap-1 pb-2">
                    <TrendingDown className="w-4 h-4 text-green-500" />
                    <span className="text-[13px] font-bold text-green-600">-2.1%</span>
                  </div>
                </div>
                <p className="text-[12px] text-gray-400 mt-2">Objetivo: Por debajo del 50.0%</p>
              </div>

              {/* Mini progress */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                  <span>0%</span>
                  <span className="text-green-600 font-semibold">Umbral 50%</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 relative">
                  <div
                    className={clsx('h-2.5 rounded-full transition-all duration-700', isOptimizado ? 'bg-blue-500' : 'bg-red-500')}
                    style={{ width: `${factorActual}%` }}
                  />
                  <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-orange-400" />
                </div>
              </div>
            </div>

            <button onClick={() => setShowMetricas(true)} className="mt-6 w-full py-3 rounded-xl border-2 border-gray-200 text-[13px] font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all">
              Ver Métricas Detalladas
            </button>
          </div>

          {/* Factor Index Trend */}
          <div className="col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-bold text-gray-900">Tendencia del Factor Índice</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Cálculo de métrica: (Gastos / Ventas) × 100
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />
                  <span className="text-gray-500">Eficiente (&lt;50%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-red-500 inline-block rounded" />
                  <span className="text-gray-500">Riesgo (&gt;50%)</span>
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[30, 70]}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={50}
                  stroke="#F97316"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{ value: '50% umbral', position: 'insideTopRight', fontSize: 10, fill: '#F97316' }}
                />
                <Line
                  type="monotone"
                  dataKey="eficiente"
                  name="Eficiente"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="riesgo"
                  name="Riesgo"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#EF4444', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-5 pb-6">

          {/* Sales vs Expenses */}
          <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-[15px] font-bold text-gray-900 mb-5">Comparación Ventas vs Gastos</h3>

            <div className="space-y-5">
              {/* Gross Sales */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-gray-500 font-medium">Ventas Brutas</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-gray-800">$142.500.000</span>
                    <span className="text-[11px] font-bold text-green-600 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />+12%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-blue-500" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Operational Expenses */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] text-gray-500 font-medium">Gastos Operacionales</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-gray-800">$68.685.000</span>
                    <span className="text-[11px] font-bold text-orange-500 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />+4%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="h-3 rounded-full bg-gray-400" style={{ width: '48%' }} />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-5 border-t border-gray-100">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Margen de Ganancia</p>
                <p className="text-[26px] font-black text-gray-900">51.8%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Ingreso Promedio Diario</p>
                <p className="text-[26px] font-black text-gray-900">$20.3M</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">Factor Índice Semana</p>
                <p className="text-[26px] font-black text-blue-600">48.2%</p>
              </div>
            </div>
          </div>

          {/* Index Deviation Alerts */}
          <div className="col-span-1 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h3 className="text-[14px] font-bold text-gray-900">Alertas de Desviación</h3>
              </div>
              {activeCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-bold">
                  {activeCount} ACTIVA{activeCount > 1 ? 'S' : ''}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {alertList.map((alerta) => (
                <div
                  key={alerta.id}
                  className={clsx(
                    'rounded-xl p-4 border',
                    alerta.acknowledged ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className={clsx(
                      'text-[12px] font-bold',
                      alerta.tipo === 'critical' ? 'text-red-600' :
                      alerta.tipo === 'warning' ? 'text-orange-500' : 'text-blue-600'
                    )}>
                      {alerta.titulo}
                    </p>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{alerta.tiempo}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-relaxed mb-3">{alerta.mensaje}</p>

                  {!alerta.acknowledged && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => acknowledge(alerta.id)}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Reconocer
                      </button>
                      <button
                        onClick={() => dismiss(alerta.id)}
                        className="flex-1 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                  {alerta.acknowledged && (
                    <span className="text-[10px] text-gray-400 font-medium">✓ Reconocida</span>
                  )}
                </div>
              ))}

              {alertList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                  <p className="text-[12px] text-gray-400">Sin alertas activas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Métricas Detalladas */}
      {showMetricas && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-gray-900">Métricas Detalladas</h2>
              <button onClick={() => setShowMetricas(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-3 pb-2 border-b border-gray-100">
                {['Día', 'Factor Eficiente', 'Factor Riesgo'].map(h => (
                  <p key={h} className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{h}</p>
                ))}
              </div>
              {trendData.map(d => (
                <div key={d.dia} className="grid grid-cols-3 gap-3 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                  <p className="text-[13px] font-semibold text-gray-700">{d.dia}</p>
                  <p className={clsx('text-[13px] font-bold', d.eficiente < 50 ? 'text-blue-600' : 'text-red-500')}>{d.eficiente}%</p>
                  <p className={clsx('text-[13px] font-bold', d.riesgo < 50 ? 'text-green-600' : 'text-red-500')}>{d.riesgo}%</p>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">Promedio Eficiente</p>
                <p className="text-[18px] font-black text-blue-600">{(trendData.reduce((s,d) => s + d.eficiente, 0) / trendData.length).toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">Promedio Riesgo</p>
                <p className="text-[18px] font-black text-red-500">{(trendData.reduce((s,d) => s + d.riesgo, 0) / trendData.length).toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide mb-1">Umbral</p>
                <p className="text-[18px] font-black text-orange-500">50.0%</p>
              </div>
            </div>
            <button onClick={() => setShowMetricas(false)} className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
