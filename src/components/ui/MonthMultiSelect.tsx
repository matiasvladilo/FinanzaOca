'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface MonthMultiSelectProps {
  /** Meses disponibles, formato "YYYY-MM", en cualquier orden. */
  mesesDisponibles: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  label?: string;
}

const MESES_ABREV = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function esContiguo(meses: string[]): boolean {
  for (let i = 1; i < meses.length; i++) {
    const [y0, m0] = meses[i - 1].split('-').map(Number);
    const [y1, m1] = meses[i].split('-').map(Number);
    if ((y1 * 12 + m1) - (y0 * 12 + m0) !== 1) return false;
  }
  return true;
}

function labelMes(key: string): string {
  const [anio, mes] = key.split('-');
  return `${MESES_ABREV[parseInt(mes, 10)]} ${anio}`;
}

function formatLabel(mesesOrdenados: string[]): string {
  if (mesesOrdenados.length === 0) return 'Sin período';
  if (mesesOrdenados.length === 1) return labelMes(mesesOrdenados[0]);
  if (esContiguo(mesesOrdenados)) {
    return `${labelMes(mesesOrdenados[0])} – ${labelMes(mesesOrdenados[mesesOrdenados.length - 1])}`;
  }
  if (mesesOrdenados.length <= 4) return mesesOrdenados.map(labelMes).join(', ');
  return `${mesesOrdenados.length} meses`;
}

export default function MonthMultiSelect({ mesesDisponibles, selected, onChange, label = 'Período' }: MonthMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const ordenados = [...selected].sort();

  const porAnio = new Map<string, string[]>();
  for (const m of [...mesesDisponibles].sort()) {
    const anio = m.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, []);
    porAnio.get(anio)!.push(m);
  }

  function toggleMes(mes: string) {
    const next = new Set(selected);
    if (next.has(mes)) next.delete(mes); else next.add(mes);
    onChange(next);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-transparent rounded-lg px-3.5 py-2 text-[12px] font-medium transition-all bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
      >
        <span className="text-[10px] font-medium opacity-70">{label}</span>
        <span className="font-semibold">{formatLabel(ordenados)}</span>
        <ChevronDown className={clsx('w-3 h-3 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 rounded-xl z-50 p-3 w-[280px] max-h-[360px] overflow-y-auto"
          style={{ background: 'var(--card)', border: '1px solid var(--border-2)', boxShadow: 'var(--card-shadow), 0 8px 24px -8px rgba(0,0,0,0.18)' }}>
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => onChange(new Set(mesesDisponibles))}
              className="flex-1 text-[11px] font-medium rounded-lg px-2 py-1.5 border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-colors" style={{ color: 'var(--text-2)' }}>
              Todos
            </button>
            <button type="button" onClick={() => onChange(new Set())}
              className="flex-1 text-[11px] font-medium rounded-lg px-2 py-1.5 border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors" style={{ color: 'var(--text-2)' }}>
              Ninguno
            </button>
          </div>

          {[...porAnio.entries()].reverse().map(([anio, meses]) => (
            <div key={anio} className="mb-3 last:mb-0">
              <p className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>{anio}</p>
              <div className="flex flex-wrap gap-1.5">
                {meses.map(m => {
                  const activo = selected.has(m);
                  return (
                    <button key={m} type="button" onClick={() => toggleMes(m)}
                      aria-pressed={activo}
                      className={clsx(
                        'text-[11px] font-medium rounded-lg px-2.5 py-1 border transition-colors',
                        activo
                          ? 'bg-blue-50 dark:bg-blue-950 border-transparent text-blue-600 dark:text-blue-400'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
                      )}>
                      {MESES_ABREV[parseInt(m.slice(5, 7), 10)]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
