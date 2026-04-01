'use client';

import Skeleton from '@/components/ui/Skeleton';

function formatCLPInt(v: number) {
  return '$' + Math.round(v).toLocaleString('es-CL');
}

interface SucursalRow {
  nombre: string;
  valor: number;
  porcentaje: number;
  color: string;
}

interface ResumenSucursalesProps {
  distribucion: SucursalRow[];
  gastosPorSucursal: Record<string, { gastos: number }>;
  totalVentas: number;
  loading: boolean;
}

export default function ResumenSucursales({
  distribucion, gastosPorSucursal, totalVentas, loading,
}: ResumenSucursalesProps) {
  if (loading) return <Skeleton className="h-full min-h-[200px]" />;

  const totalGastos = Object.values(gastosPorSucursal).reduce((s, v) => s + v.gastos, 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 h-full">
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Resumen por Sucursal</h3>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
          Ventas · Gastos · Índice 60 · Participación
        </p>
      </div>

      {/* overflow-x-auto para scroll horizontal en mobile */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-[12px] min-w-[360px]">
          <thead>
            <tr className="text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-wider border-b border-gray-100 dark:border-gray-800">
              <th className="text-left pb-2 font-semibold">Sucursal</th>
              <th className="text-right pb-2 font-semibold">Ventas</th>
              <th className="text-right pb-2 font-semibold hidden sm:table-cell">Gastos</th>
              <th className="text-right pb-2 font-semibold hidden md:table-cell">Índice 60</th>
              <th className="text-right pb-2 font-semibold">% Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {distribucion.map((suc) => {
              const gastos = gastosPorSucursal[suc.nombre]?.gastos ?? 0;
              const indice = suc.valor > 0 ? (gastos / suc.valor) * 100 : null;
              const indiceOk = indice !== null && indice <= 50;
              return (
                <tr key={suc.nombre} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: suc.color }} />
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{suc.nombre}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                    {formatCLPInt(suc.valor)}
                  </td>
                  <td className="py-2.5 text-right text-red-500 dark:text-red-400 font-medium hidden sm:table-cell">
                    {gastos > 0 ? formatCLPInt(gastos) : '—'}
                  </td>
                  <td className="py-2.5 text-right hidden md:table-cell">
                    {indice !== null ? (
                      <span className={`font-semibold ${indiceOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                        {indice.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <div className="h-1.5 rounded-full bg-blue-100 dark:bg-blue-950 w-12 lg:w-16 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: suc.porcentaje + '%' }} />
                      </div>
                      <span className="text-gray-500 dark:text-gray-400 w-7 text-right">{suc.porcentaje}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {distribucion.length > 0 && (
            <tfoot className="border-t border-gray-200 dark:border-gray-700">
              <tr>
                <td className="pt-2.5 font-bold text-gray-900 dark:text-white text-[11px] uppercase tracking-wide">Total</td>
                <td className="pt-2.5 text-right font-bold text-gray-900 dark:text-white">{formatCLPInt(totalVentas)}</td>
                <td className="pt-2.5 text-right font-bold text-red-500 dark:text-red-400 hidden sm:table-cell">{formatCLPInt(totalGastos)}</td>
                <td className="pt-2.5 text-right hidden md:table-cell">
                  {totalVentas > 0 ? (
                    <span className={`font-bold ${(totalGastos / totalVentas) * 100 <= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {((totalGastos / totalVentas) * 100).toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
                <td className="pt-2.5 text-right text-gray-400 dark:text-gray-500 font-semibold">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {distribucion.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-500 text-[12px] py-8">
          Sin datos para el período seleccionado
        </p>
      )}
    </div>
  );
}
