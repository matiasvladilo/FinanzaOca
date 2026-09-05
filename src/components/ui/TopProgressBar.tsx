'use client';

/**
 * Barra de carga sutil, estilo LATAM: una franja angosta que recorre
 * un track translúcido en loop. Vive en el flujo normal (no absoluta)
 * pegada al borde superior de la sección de KPIs, para que sea visible
 * siempre que `active` esté prendido.
 */
export default function TopProgressBar({ active = true }: { active?: boolean }) {
  return (
    <div
      className="h-[2px] w-full rounded-full overflow-hidden mb-2.5 transition-colors duration-200"
      style={{ background: active ? 'var(--hover)' : 'transparent' }}
      aria-hidden="true"
    >
      {active && (
        <div
          className="h-full w-1/4 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--active-text), transparent)',
            animation: 'topbar-slide 1.4s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
