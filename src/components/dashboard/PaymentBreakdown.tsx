'use client';

import Skeleton from '@/components/ui/Skeleton';

function formatCLPInt(v: number) {
  return '$' + Math.round(v).toLocaleString('es-CL');
}

interface PaymentBreakdownProps {
  medioPago: { efectivo: number; tarjeta: number; transf: number };
  loading: boolean;
}

const ITEMS = [
  { key: 'efectivo' as const, label: 'Efectivo',      color: '#2563EB', bg: 'bg-blue-100 dark:bg-blue-950',     text: 'text-blue-700 dark:text-blue-400' },
  { key: 'tarjeta'  as const, label: 'Tarjeta',       color: '#7C3AED', bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-400' },
  { key: 'transf'   as const, label: 'Transferencia', color: '#059669', bg: 'bg-green-100 dark:bg-green-950',   text: 'text-green-700 dark:text-green-400' },
];

export default function PaymentBreakdown({ medioPago, loading }: PaymentBreakdownProps) {
  if (loading) return <Skeleton className="h-full min-h-[200px]" />;

  const total = (medioPago.efectivo + medioPago.tarjeta + medioPago.transf) || 1;
  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 h-full"
      style={{ boxShadow: 'var(--card-shadow)' }}>
      <div className="mb-4">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">Medio de Pago</h3>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
          Distribución de ventas en caja
        </p>
      </div>

      {/* Barra de progreso segmentada */}
      <div className="flex rounded-full overflow-hidden h-2.5 mb-5 gap-[3px]">
        {ITEMS.map(item => (
          <div
            key={item.key}
            className="transition-all duration-700 first:rounded-l-full last:rounded-r-full"
            style={{ width: pct(medioPago[item.key]) + '%', backgroundColor: item.color }}
          />
        ))}
      </div>

      <div className="space-y-3.5">
        {ITEMS.map(item => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                {formatCLPInt(medioPago[item.key])}
              </span>
              <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[38px] text-center ' + item.bg + ' ' + item.text}>
                {pct(medioPago[item.key])}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
