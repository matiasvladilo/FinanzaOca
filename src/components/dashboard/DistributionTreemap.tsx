'use client';

import clsx from 'clsx';
import type { SucursalDistribucion } from '@/types';

interface Props {
  data: SucursalDistribucion[];
  onSucursalClick?: (nombre: string) => void;
  activeSucursal?: string;
  loading?: boolean;
}

function formatCLPInt(v: number) {
  return '$' + Math.round(v).toLocaleString('es-CL');
}

function Skeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full">
      <div className="mb-4 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function DistributionTreemap({ data, onSucursalClick, activeSucursal, loading }: Props) {
  if (loading) return <Skeleton />;

  const isSingle = data.length === 1;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Distribución por Sucursal</h3>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
            Clic para filtrar
          </p>
        </div>
        {activeSucursal && activeSucursal !== 'Todas' && (
          <button
            onClick={() => onSucursalClick?.('Todas')}
            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            Ver todas
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[12px] text-gray-400 dark:text-gray-500">Sin datos</p>
        </div>
      ) : (
        <div className={clsx('flex-1 gap-2', isSingle ? 'flex' : 'grid grid-cols-2 grid-rows-2')}>
          {data.map((suc) => {
            const isActive = activeSucursal === suc.nombre;
            return (
              <div
                key={suc.nombre}
                onClick={() => onSucursalClick?.(suc.nombre)}
                style={{ backgroundColor: suc.color }}
                className={clsx(
                  'rounded-xl flex flex-col justify-between p-4 cursor-pointer transition-all duration-200',
                  isSingle ? 'flex-1' : '',
                  isActive
                    ? 'ring-2 ring-white ring-offset-2 scale-[0.98]'
                    : 'hover:opacity-90 hover:scale-[0.99]'
                )}
              >
                <div>
                  <p className="text-white font-bold text-[10px] tracking-widest uppercase">
                    {suc.nombre}
                  </p>
                  <p className="text-white text-[18px] font-bold mt-1 leading-tight">
                    {formatCLPInt(suc.valor)}
                  </p>
                </div>
                <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wide">
                  {suc.porcentaje}% del total
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest">Total acumulado</p>
        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
          {formatCLPInt(data.reduce((s, d) => s + d.valor, 0))}
        </p>
      </div>
    </div>
  );
}
