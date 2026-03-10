'use client';

import { TrendingUp, TrendingDown, FileText, BarChart2, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import type { KPIData } from '@/types';
import { formatCLP } from '@/lib/mock-data';

interface KPICardProps {
  label: string;
  value: string;
  delta: string;
  deltaLabel: string;
  positive: boolean;
  icon: React.ReactNode;
  alert?: boolean;
}

function KPICard({ label, value, delta, deltaLabel, positive, icon, alert }: KPICardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl p-5 flex flex-col gap-3 shadow-sm border',
        alert ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{label}</span>
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', alert ? 'bg-red-50' : 'bg-blue-50')}>
          {icon}
        </div>
      </div>

      <div>
        <p className={clsx('text-[28px] font-bold leading-tight', alert ? 'text-red-600' : 'text-gray-900')}>
          {value}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {positive ? (
          <TrendingUp className={clsx('w-3.5 h-3.5', alert ? 'text-red-500' : 'text-green-500')} />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        )}
        <span
          className={clsx(
            'text-[11px] font-semibold',
            alert ? 'text-red-500' : positive ? 'text-green-600' : 'text-red-500'
          )}
        >
          {delta}
        </span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">{deltaLabel}</span>
      </div>
    </div>
  );
}

interface KPICardsProps {
  data: KPIData;
}

export default function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: 'Ventas Brutas',
      value: formatCLP(data.ventasBrutas),
      delta: '+12.5%',
      deltaLabel: 'YOY Benchmark',
      positive: true,
      icon: <FileText className="w-4 h-4 text-blue-600" />,
      alert: false,
    },
    {
      label: 'OPEX Total',
      value: formatCLP(data.opexTotal),
      delta: '-2.3%',
      deltaLabel: 'Ratio de Varianza',
      positive: false,
      icon: <BarChart2 className="w-4 h-4 text-blue-600" />,
      alert: false,
    },
    {
      label: 'Rendimiento Neto',
      value: `${data.rendimientoNeto.toFixed(2)}%`,
      delta: '+4.1%',
      deltaLabel: 'Objetivo: 25.0%',
      positive: true,
      icon: <TrendingUp className="w-4 h-4 text-blue-600" />,
      alert: false,
    },
    {
      label: 'Factor Index 50',
      value: `${data.factorIndex}%`,
      delta: '+1.2%',
      deltaLabel: 'Sobre umbral',
      positive: true,
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      alert: true,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}
