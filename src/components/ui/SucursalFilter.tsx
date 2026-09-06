'use client';

interface SucursalFilterProps {
  /** Opciones disponibles (sin "Todas" — el chip "Todas" es implícito). */
  sucursales: string[];
  /** Vacío = "Todas" (sin filtro). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Rol restringido a una sola sucursal fija: se muestra sin interacción. */
  disabled?: boolean;
  className?: string;
}

const chipBase =
  'px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap';

export default function SucursalFilter({
  sucursales, selected, onChange, disabled, className,
}: SucursalFilterProps) {
  const todasActiva = selected.length === 0;

  if (disabled) {
    const unica = selected[0] ?? sucursales[0] ?? '';
    return (
      <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
        <span
          className={chipBase}
          style={{ background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }}
        >
          {unica}
        </span>
      </div>
    );
  }

  const toggle = (s: string) => {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  };

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onChange([])}
        className={chipBase}
        style={todasActiva
          ? { background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }
          : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
      >
        Todas
      </button>
      {sucursales.map(s => {
        const activa = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            aria-pressed={activa}
            className={chipBase}
            style={activa
              ? { background: 'var(--active-bg)', borderColor: 'var(--active-bg)', color: 'var(--active-text)' }
              : { background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
