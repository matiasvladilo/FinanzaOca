'use client';

/**
 * Aviso de facturas excluidas de los totales por no tener fecha de vencimiento.
 *
 * La app imputa cada gasto por la columna de vencimiento ("FECHA EMITIDA" en las
 * planillas de los locales). Si esa celda está vacía o mal escrita, la factura no
 * se puede asignar a ningún mes y queda fuera de todos los números. Antes eso
 * pasaba en silencio; acá se muestra con el número de fila para corregirlo en la
 * planilla, que es donde está el problema.
 *
 * Colapsado por defecto: es información de mantenimiento, no debe competir con
 * los KPIs.
 */

import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface FacturaSinFecha {
  sucursal: string;
  fila: number;
  proveedor: string;
  monto: number;
  fechaRecepcion: string;
  valorCelda: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

/** Describe qué tiene la celda, para que se entienda qué hay que arreglar */
function describeCelda(v: string): string {
  if (!v) return 'vacía';
  if (!v.trim()) return 'sólo espacios';
  return `"${v.trim()}"`;
}

export default function FacturasSinFecha({ facturas }: { facturas: FacturaSinFecha[] }) {
  const [abierto, setAbierto] = useState(false);
  if (!facturas.length) return null;

  const total = facturas.reduce((s, f) => s + f.monto, 0);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <button
        onClick={() => setAbierto(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-500/5 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="flex-1 text-[12px] leading-snug min-w-0" style={{ color: 'var(--text)' }}>
          <span className="font-bold">
            {facturas.length} {facturas.length === 1 ? 'factura sin fecha de vencimiento' : 'facturas sin fecha de vencimiento'}
          </span>
          <span className="text-gray-400"> — {fmt(total)} fuera de los totales</span>
        </p>
        <ChevronDown className={clsx('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <p className="px-4 pt-3 pb-2 text-[11px] text-gray-400 leading-relaxed">
            El gasto se imputa por la fecha de vencimiento. Estas facturas la tienen vacía o mal
            escrita, así que no se pueden asignar a ningún mes y no suman en ninguna vista.
            Completá la columna <strong style={{ color: 'var(--text)' }}>FECHA EMITIDA</strong> en la
            fila indicada de cada planilla y vuelven solas.
          </p>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0" style={{ background: 'var(--card)' }}>
                <tr className="text-gray-400 text-left">
                  <th className="font-semibold px-4 py-1.5">Planilla</th>
                  <th className="font-semibold px-2 py-1.5">Fila</th>
                  <th className="font-semibold px-2 py-1.5">Proveedor</th>
                  <th className="font-semibold px-2 py-1.5 text-right">Monto</th>
                  <th className="font-semibold px-2 py-1.5 hidden sm:table-cell">Recibida</th>
                  <th className="font-semibold px-4 py-1.5 hidden md:table-cell">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={`${f.sucursal}-${f.fila}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-1.5 font-semibold" style={{ color: 'var(--text)' }}>{f.sucursal}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-400">{f.fila}</td>
                    <td className="px-2 py-1.5 truncate max-w-[10rem]" style={{ color: 'var(--text)' }}>
                      {f.proveedor || <span className="text-gray-500">sin proveedor</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(f.monto)}</td>
                    <td className="px-2 py-1.5 text-gray-400 hidden sm:table-cell">{f.fechaRecepcion || '—'}</td>
                    <td className="px-4 py-1.5 text-amber-500 hidden md:table-cell">{describeCelda(f.valorCelda)}</td>
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
