'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export interface PeriodOption {
  label: string;
  value: string;
}

type AccentColor = 'blue' | 'violet';

/** Tokens de color por variante de acento. rgb se usa para el tinte
 *  translúcido de selección (funciona igual en claro/oscuro/dracula
 *  porque no depende de un fondo pastel fijo). */
const ACCENT: Record<AccentColor, {
  triggerActive: string;
  hoverBorder: string;
  hoverText: string;
  hoverTextDark: string;
  solidText: string;
  rgb: string;
}> = {
  blue: {
    triggerActive: 'bg-blue-600 border-blue-600 text-white',
    hoverBorder: 'hover:border-blue-400',
    hoverText: 'hover:text-blue-600',
    hoverTextDark: 'hover:text-blue-400',
    solidText: 'text-blue-600',
    rgb: '37, 99, 235', // blue-600
  },
  violet: {
    triggerActive: 'bg-violet-600 border-violet-600 text-white',
    hoverBorder: 'hover:border-violet-400',
    hoverText: 'hover:text-violet-600',
    hoverTextDark: 'hover:text-violet-400',
    solidText: 'text-violet-600',
    rgb: '124, 58, 237', // violet-600
  },
};

interface PeriodSelectProps {
  value: string;
  options: PeriodOption[];
  onChange: (value: string) => void;
  label?: string;
  /** Texto a mostrar cuando ningún valor está seleccionado (value === '') */
  allLabel?: string;
  /** 'sm' para barra de filtros oscura en mobile */
  size?: 'sm' | 'md';
  /** Variante oscura para fondo oscuro */
  dark?: boolean;
  /** Color de acento del trigger y del dropdown. Default: 'blue'. */
  accentColor?: AccentColor;
}

export function PeriodSelect({
  value,
  options,
  onChange,
  label,
  allLabel = 'Todos',
  size = 'md',
  dark = false,
  accentColor = 'blue',
}: PeriodSelectProps) {
  const [open, setOpen] = useState(false);
  // Controla la animación de entrada: el panel se monta con opacidad 0 /
  // levemente desplazado, y en el siguiente frame anima a su estado final.
  const [entered, setEntered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const accent = ACCENT[accentColor];

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  // Dispara el frame de "entrada" apenas se monta el panel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) { setEntered(false); return; }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? allLabel;
  const isFiltered = value !== '';

  return (
    <div className="relative" ref={ref}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        suppressHydrationWarning
        className={clsx(
          'flex items-center gap-1 border rounded-xl font-medium transition-all select-none',
          size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-[12px]',
          isFiltered
            ? accent.triggerActive
            : dark
              ? clsx('bg-slate-700 border-slate-600 text-slate-200', accent.hoverBorder, accent.hoverTextDark)
              : clsx('bg-white border-gray-200 text-gray-600', accent.hoverBorder, accent.hoverText),
        )}
      >
        {label && (
          <span suppressHydrationWarning className={clsx('text-[10px] font-bold uppercase tracking-widest', isFiltered ? 'opacity-80' : 'opacity-60')}>
            {label}
          </span>
        )}
        <span className="font-semibold">{displayLabel}</span>
        <ChevronDown
          suppressHydrationWarning
          className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180', isFiltered ? 'opacity-80' : 'opacity-50')}
        />
      </button>

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 rounded-xl shadow-lg overflow-y-auto overscroll-contain z-50 min-w-[180px] py-1 transition-all duration-150 ease-out"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-2)',
            boxShadow: 'var(--card-shadow), 0 8px 24px -8px rgba(0,0,0,0.18)',
            opacity: entered ? 1 : 0,
            transform: entered ? 'translateY(0)' : 'translateY(-4px)',
            // Con muchas opciones (ej. muchos meses disponibles) el panel se
            // cortaba contra el borde de la ventana sin forma de scrollear.
            maxHeight: 'min(320px, calc(100vh - 100px))',
          }}
        >
          {/* Opción "Todos" siempre al inicio */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={clsx(
              'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
              value === '' ? clsx('font-semibold', accent.solidText) : '',
            )}
            style={value === ''
              ? { background: `rgba(${accent.rgb}, 0.12)` }
              : { color: 'var(--text-2)' }}
            onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={e => { if (value !== '') e.currentTarget.style.background = 'transparent'; }}
          >
            {allLabel}
            {value === '' && <Check className={clsx('w-3.5 h-3.5 flex-shrink-0', accent.solidText)} />}
          </button>

          {options.filter(o => o.value !== '').map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={clsx(
                'w-full text-left px-4 py-2.5 text-[12px] transition-colors flex items-center justify-between gap-3',
                value === opt.value ? clsx('font-semibold', accent.solidText) : '',
              )}
              style={value === opt.value
                ? { background: `rgba(${accent.rgb}, 0.12)` }
                : { color: 'var(--text)' }}
              onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
              {value === opt.value && <Check className={clsx('w-3.5 h-3.5 flex-shrink-0', accent.solidText)} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
