'use client';

import { memo } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { DailyData } from '@/types';

interface SucursalSerie {
  nombre: string;
  color: string;
}

interface Props {
  data: DailyData[] | Record<string, any>[];
  chartType?: 'bar' | 'line';
  loading?: boolean;
  error?: string | null;
  accentColor?: string;
  sucursalSeries?: SucursalSerie[];
}

const formatYAxis = (value: number) => {
  if (value >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return '$' + Math.round(value / 1_000) + 'k';
  return '$' + value;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-[12px]"
      style={{ boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.08)' }}>
      <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill ?? entry.stroke }} />
            <span className="text-gray-500 dark:text-gray-400">{entry.name}</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">${entry.value.toLocaleString('es-CL')}</span>
        </div>
      ))}
    </div>
  );
};

function DailyPerformanceChart({ data, chartType = 'bar', loading, error, accentColor = '#2563EB', sucursalSeries = [] }: Props) {
  const isMultiSucursal = sucursalSeries.length > 0;
  const chartContent = () => {
    if (loading) return <div className="h-[200px] sm:h-[260px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />;
    if (error)   return (
      <div className="h-[200px] sm:h-[260px] flex items-center justify-center">
        <p className="text-[12px] text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
    if (data.length === 0) return (
      <div className="h-[200px] sm:h-[260px] flex items-center justify-center">
        <p className="text-[12px] text-gray-400 dark:text-gray-500">Sin datos para el período seleccionado</p>
      </div>
    );

    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="4 2" stroke="var(--chart-grid)" vertical={false} strokeWidth={1} />
        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} dy={4} />
        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} axisLine={false} tickLine={false} width={46} />
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '14px' }}
          formatter={(value) => <span style={{ color: 'var(--chart-axis)' }}>{value}</span>} />
      </>
    );

    if (isMultiSucursal) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data} barCategoryGap="35%" barGap={3} maxBarSize={36}>
              {commonAxis}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--hover)', radius: 6 }} />
              {sucursalSeries.map(s => (
                <Bar key={s.nombre} dataKey={s.nombre} name={s.nombre} fill={s.color} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data}>
              {commonAxis}
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-2)', strokeWidth: 1.5, strokeDasharray: '4 2' }} />
              {sucursalSeries.map(s => (
                <Line key={s.nombre} type="monotone" dataKey={s.nombre} name={s.nombre} stroke={s.color} strokeWidth={3}
                  dot={{ r: 4, fill: s.color, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 7, strokeWidth: 0 }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'bar' ? (
          <BarChart data={data} barCategoryGap="35%" barGap={3} maxBarSize={36}>
            {commonAxis}
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--hover)', radius: 6 }} />
            <Bar dataKey="ventas" name="Ventas" fill={accentColor} radius={[6, 6, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#64748B" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            {commonAxis}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-2)', strokeWidth: 1.5, strokeDasharray: '4 2' }} />
            <Line type="monotone" dataKey="ventas" name="Ventas" stroke={accentColor} strokeWidth={3} dot={{ r: 4, fill: accentColor, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 7, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="gastos" name="Gastos" stroke="#64748B" strokeWidth={2} dot={{ r: 3, fill: '#64748B', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5, strokeWidth: 0 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800"
      style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">
            {isMultiSucursal ? `Comparando: ${sucursalSeries.map(s => s.nombre).join(' vs ')}` : 'Ventas vs Gastos — Por Mes'}
          </h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
            {isMultiSucursal ? 'Ventas por sucursal seleccionada' : 'Desde Cierre de Caja y Facturas'}
          </p>
        </div>
        <span className={'text-[10px] font-bold px-2.5 py-1 rounded-full ' + (chartType === 'bar'
          ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
          : 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400'
        )}>
          {chartType === 'bar' ? 'BARRAS' : 'LINEA'}
        </span>
      </div>
      <div className="h-[200px] sm:h-[260px]">
        {chartContent()}
      </div>
    </div>
  );
}

// React.memo: evita re-renders cuando el parent cambia pero los datos del gráfico no
export default memo(DailyPerformanceChart);
