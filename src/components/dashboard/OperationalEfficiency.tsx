'use client';

import clsx from 'clsx';
import type { EficienciaOperacional } from '@/types';

interface Props {
  data: EficienciaOperacional[];
}

const getBarColor = (fi: number) => {
  if (fi >= 75) return 'bg-red-500';
  if (fi >= 50) return 'bg-blue-500';
  return 'bg-green-500';
};

const getFITextColor = (fi: number) => {
  if (fi >= 75) return 'text-red-600';
  if (fi >= 50) return 'text-blue-600';
  return 'text-green-600';
};

export default function OperationalEfficiency({ data }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[14px] font-bold text-gray-900">Eficiencia Operacional</h3>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Por Sucursal
        </span>
      </div>

      {/* Bars */}
      <div className="flex-1 space-y-5">
        {data.map((item) => (
          <div key={item.sucursal}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-semibold text-gray-700">{item.sucursal}</span>
              <span className={clsx('text-[12px] font-bold', getFITextColor(item.fi))}>
                FI: {item.fi}%
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={clsx('h-2 rounded-full transition-all duration-500', getBarColor(item.fi))}
                style={{ width: `${item.fi}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Critical Vector */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <p className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">
            Vector Crítico
          </p>
        </div>
        <p className="text-[11px] text-gray-500 italic leading-relaxed">
          "Las desviaciones sostenidas del Factor Index en PV (&gt;50%) se correlacionan con
          ineficiencias de abastecimiento."
        </p>
      </div>
    </div>
  );
}
