'use client';

import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { DailyData } from '@/types';

interface Props {
  data: DailyData[];
  chartType?: 'bar' | 'line';
  loading?: boolean;
}

const formatYAxis = (value: number) => {
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return '$' + Math.round(value / 1_000) + 'k';
  return '$' + value;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3 text-[12px]">
      <p className="font-semibold text-gray-700 dark:text-gray-200 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.fill ?? entry.stroke }} />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-800 dark:text-gray-100">${entry.value.toLocaleString('es-CL')}</span>
        </div>
      ))}
    </div>
  );
};

export default function DailyPerformanceChart({ data, chartType = 'bar', loading }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Ventas vs Gastos — Por Mes</h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
            Desde Cierre de Caja y Facturas
          </p>
        </div>
        <span className={'text-[10px] font-bold px-2.5 py-1 rounded-full ' + (chartType === 'bar' ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400')}>
          {chartType === 'bar' ? 'BARRAS' : 'LINEA'}
        </span>
      </div>

      {loading ? (
        <div className="h-[260px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ) : data.length === 0 ? (
        <div className="h-[260px] flex items-center justify-center">
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Sin datos para el período seleccionado</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {chartType === 'bar' ? (
            <BarChart data={data} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                formatter={(value) => <span style={{ color: 'var(--chart-axis)' }}>{value}</span>} />
              <Bar dataKey="ventas" name="Ventas" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#94A3B8" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                formatter={(value) => <span style={{ color: 'var(--chart-axis)' }}>{value}</span>} />
              <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#94A3B8" strokeWidth={2} dot={{ r: 3, fill: '#94A3B8', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
