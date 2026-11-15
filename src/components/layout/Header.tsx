'use client';

import Image from 'next/image';
import type { DashboardFilters } from '@/types';

/** Header de marca compartido por todas las páginas: barra navy con el
 *  wordmark "La Oca". Los filtros de cada página van en una sub-barra clara
 *  debajo, no acá. Las props quedan opcionales por compatibilidad con las
 *  páginas que todavía las pasan; no se usan. */
interface HeaderProps {
  filters?: DashboardFilters;
  onFiltersChange?: (filters: DashboardFilters) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Header(_props: HeaderProps) {
  return (
    // pr-16/sm:pr-20 reserva el lugar del botón del asistente, que es fixed
    // arriba a la derecha (AsistenteBubble) y queda centrado en esta barra.
    <header className="flex items-center pl-3 pr-16 sm:pl-6 sm:pr-20 py-4 sm:py-5 sticky top-0 z-30"
      style={{ background: 'var(--header-bg)' }}>
      <Image
        src="/brand/la-oca-wordmark.png"
        alt="La Oca"
        width={1536}
        height={364}
        priority
        className="h-7 sm:h-8 w-auto select-none"
      />
    </header>
  );
}
