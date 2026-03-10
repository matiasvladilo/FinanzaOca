'use client';

import clsx from 'clsx';
import type { SucursalDistribucion } from '@/types';
import { formatCLP } from '@/lib/mock-data';

interface Props {
  data: SucursalDistribucion[];
  onSucursalClick?: (nombre: string) => void;
  activeSucursal?: string;
}

const blueShades = ['bg-blue-700', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'];

export default function DistributionTreemap({ data, onSucursalClick, activeSucursal }: Props) {
  const isSingle = data.length === 1;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900">Distribución por Sucursal</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
            Clic para filtrar el dashboard
          </p>
        </div>
        {activeSucursal && activeSucursal !== 'Todas' && (
          <button
            onClick={() => onSucursalClick?.('Todas')}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Ver todas
          </button>
        )}
      </div>

      <div className={clsx('flex-1 gap-2', isSingle ? 'flex' : 'grid grid-cols-2 grid-rows-2')}>
        {data.map((sucursal, i) => {
          const isActive = activeSucursal === sucursal.nombre;
          return (
            <div
              key={sucursal.nombre}
              onClick={() => onSucursalClick?.(sucursal.nombre)}
              className={clsx(
                'rounded-xl flex flex-col justify-between p-4 cursor-pointer transition-all duration-200',
                isSingle ? 'flex-1' : '',
                blueShades[i] ?? 'bg-blue-200',
                isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-blue-500 scale-[0.98]' : 'hover:opacity-90 hover:scale-[0.99]'
              )}
            >
              <div>
                <p className="text-white font-bold text-[11px] tracking-widest uppercase">
                  {sucursal.nombre}
                </p>
                <p className="text-white text-[22px] font-bold mt-1">
                  {formatCLP(sucursal.valor)}
                </p>
              </div>
              <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wide">
                {sucursal.porcentaje}% del total
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Integridad de composición</p>
        <p className="text-[11px] font-bold text-green-600">100% valorizado</p>
      </div>
    </div>
  );
}
