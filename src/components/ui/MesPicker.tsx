'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function mesKeyToLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
}

export function generarMeses(n = 18): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: mesKeyToLabel(key) };
  });
}

export function defaultMesRange(): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
  const desde = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;
  return { desde, hasta };
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function MesPicker({
  desde,
  hasta,
  onChange,
  mesesDisponibles,
}: {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  mesesDisponibles?: string[]; // si se pasa, solo muestra esos meses
}) {
  const [open, setOpen]       = useState(false);
  const [picking, setPicking] = useState<'desde' | 'hasta'>('desde');
  const ref   = useRef<HTMLDivElement>(null);
  const mesesFallback = useMemo(() => generarMeses(18), []);
  const meses = useMemo(() => {
    if (mesesDisponibles && mesesDisponibles.length > 0) {
      return mesesDisponibles.map(key => ({ key, label: mesKeyToLabel(key) }));
    }
    return mesesFallback;
  }, [mesesDisponibles, mesesFallback]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  function handleClick(key: string) {
    if (picking === 'desde') {
      onChange(key, key > hasta ? key : hasta);
      setPicking('hasta');
    } else {
      onChange(key < desde ? key : desde, key < desde ? desde : key);
      setPicking('desde');
      setOpen(false);
    }
  }

  function handleReset() {
    const def = defaultMesRange();
    onChange(def.desde, def.hasta);
    setOpen(false);
    setPicking('desde');
  }

  const label = desde === hasta
    ? mesKeyToLabel(desde)
    : `${mesKeyToLabel(desde)} → ${mesKeyToLabel(hasta)}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(o => !o); setPicking('desde'); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-colors"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text-2)' }}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
        <span>{label}</span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-3)' }} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-2xl border shadow-xl z-30 p-3"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', minWidth: 280 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5 px-1"
            style={{ color: 'var(--text-3)' }}>
            {picking === 'desde' ? '① Selecciona el mes de inicio' : '② Selecciona el mes de fin'}
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {meses.map(({ key, label: lbl }) => {
              const isDesde  = key === desde;
              const isHasta  = key === hasta;
              const inRange  = key >= desde && key <= hasta;
              const isActive = isDesde || isHasta;
              return (
                <button
                  key={key}
                  onClick={() => handleClick(key)}
                  className="rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors text-center"
                  style={{
                    background: isActive
                      ? 'var(--active-bg)'
                      : inRange
                        ? 'color-mix(in srgb, var(--active-bg) 25%, transparent)'
                        : 'transparent',
                    color:      isActive ? 'var(--active-text)' : inRange ? 'var(--text)' : 'var(--text-2)',
                    fontWeight: isActive ? 700 : inRange ? 600 : 400,
                    border:     isActive ? '1.5px solid var(--active-text)' : '1.5px solid transparent',
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2.5 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {desde === hasta ? mesKeyToLabel(desde) : `${mesKeyToLabel(desde)} → ${mesKeyToLabel(hasta)}`}
            </span>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg"
              style={{ color: 'var(--text-3)' }}
            >
              <X className="w-3 h-3" /> Resetear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
