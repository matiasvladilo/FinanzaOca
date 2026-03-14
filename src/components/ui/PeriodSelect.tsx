'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface PeriodOption {
  label: string;
  value: string;
}

interface PeriodSelectProps {
  value: string;
  options: PeriodOption[];
  onChange: (value: string) => void;
  label?: string;
  /** Texto a mostrar cuando ningún valor está seleccionado (value === '') */
  allLabel?: string;
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label,
  allLabel = 'Todos',
}: PeriodSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? allLabel;
  const isFiltered = value !== '';

  return (
    <div className="relative" ref={ref}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'flex items-center gap-1.5 border rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all select-none',
          isFiltered
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600',
        )}
      >
        {label && (
          <span className={clsx('text-[10px] font-bold uppercase tracking-widest', isFiltered ? 'opacity-80' : 'opacity-60')}>
            {label}
          </span>
        )}
        <span className="font-semibold">{displayLabel}</span>
        <ChevronDown
          className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180', isFiltered ? 'opacity-80' : 'opacity-50')}
        />
      </button>

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 min-w-[180px] py-1">
          {/* Opción "Todos" siempre al inicio */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
              value === '' ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-500 hover:bg-gray-50',
            )}
          >
            {allLabel}
            {value === '' && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
          </button>

          {options.filter(o => o.value !== '').map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
                value === opt.value ? 'text-blue-600 font-semibold bg-blue-50' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {opt.label}
              {value === opt.value && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
