'use client';

/**
 * Aviso de merma excluida de los totales por no tener una fecha utilizable.
 *
 * Sin fecha válida la fila no se puede imputar a ningún mes, así que queda
 * fuera del dashboard, del explorador y de los informes. Antes eso pasaba en
 * silencio; acá se muestra con el número de fila para corregirlo en la
 * planilla, que es donde está el problema.
 *
 * Mismo patrón que FacturasSinFecha en el dashboard de ventas: colapsado por
 * defecto, porque es información de mantenimiento y no debe competir con
 * los KPIs.
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface MermaSinFechaItem {
  local: string;
  fila: number;
  producto: string;
  tipo: string;
  monto: number;
  valorCelda: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

/** Describe qué tiene la celda, para que se entienda qué hay que arreglar. */
function describeCelda(v: string): string {
  if (!v) return 'vacía';
  if (!v.trim()) return 'sólo espacios';
  return `"${v.trim()}"`;
}

export default function MermaSinFecha({ items }: { items: MermaSinFechaItem[] }) {
  const [abierto, setAbierto] = useState(false);
  if (!items.length) return null;

  const total = items.reduce((s, f) => s + f.monto, 0);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <button
        onClick={() => setAbierto(o => !o)}
        aria-expanded={abierto}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50/60 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="flex-1 text-[12px] leading-snug min-w-0 text-gray-900">
          <span className="font-bold">
            {items.length} {items.length === 1 ? 'registro de merma sin fecha válida' : 'registros de merma sin fecha válida'}
          </span>
          <span className="text-gray-400"> — {fmt(total)} fuera de los totales</span>
        </p>
        <ChevronDown className={clsx('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="border-t border-gray-100">
          <p className="px-4 pt-3 pb-2 text-[11px] text-gray-400 leading-relaxed">
            La merma se imputa al mes por su fecha. Estas filas la tienen vacía o mal escrita, así que
            no aparecen en ninguna vista ni en los informes. Corregí la columna{' '}
            <strong className="text-gray-700">FECHA</strong> en la fila indicada de cada planilla y
            vuelven solas.
          </p>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-gray-400 text-left">
                  <th className="font-semibold px-4 py-1.5">Planilla</th>
                  <th className="font-semibold px-2 py-1.5">Fila</th>
                  <th className="font-semibold px-2 py-1.5">Producto</th>
                  <th className="font-semibold px-2 py-1.5 hidden sm:table-cell">Tipo</th>
                  <th className="font-semibold px-2 py-1.5 text-right">Monto</th>
                  <th className="font-semibold px-4 py-1.5 hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {items.map(f => (
                  <tr key={`${f.local}-${f.fila}`} className="border-t border-gray-100">
                    <td className="px-4 py-1.5 font-semibold text-gray-800">{f.local}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-400">{f.fila}</td>
                    <td className="px-2 py-1.5 truncate max-w-[10rem] text-gray-800">
                      {f.producto || <span className="text-gray-400">sin producto</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-500 hidden sm:table-cell">{f.tipo || '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-gray-800">{fmt(f.monto)}</td>
                    <td className="px-4 py-1.5 text-amber-600 hidden md:table-cell">{describeCelda(f.valorCelda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
