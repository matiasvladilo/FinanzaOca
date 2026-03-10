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
}

const formatYAxis = (value: number) => {
  if (value >= 1000000) return `$${value / 1000000}M`;
  if (value >= 1000) return `$${value / 1000}k`;
  return `$${value}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-[12px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.fill ?? entry.stroke }} />
            <span className="text-gray-500">{entry.name}:</span>
            <span className="font-semibold text-gray-800">${entry.value.toLocaleString('es-CL')}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const commonAxis = (
  <>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
    <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
    <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
    <Tooltip content={<CustomTooltip />} />
    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
      formatter={(value) => <span style={{ color: '#6B7280' }}>{value}</span>} />
  </>
);

export default function DailyPerformanceChart({ data, chartType = 'bar' }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Rendimiento Diario Granular</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
            Ventas vs Gastos — {chartType === 'bar' ? 'Comparación lado a lado' : 'Tendencia de línea'}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${chartType === 'bar' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {chartType === 'bar' ? 'BARRAS' : 'LÍNEA'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        {chartType === 'bar' ? (
          <BarChart data={data} barCategoryGap="30%" barGap={2}>
            {commonAxis}
            <Bar dataKey="ventas" name="Ventas Brutas" fill="#2563EB" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos Netos" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            {commonAxis}
            <Line type="monotone" dataKey="ventas" name="Ventas Brutas" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="gastos" name="Gastos Netos" stroke="#D1D5DB" strokeWidth={2} dot={{ r: 3, fill: '#D1D5DB', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
