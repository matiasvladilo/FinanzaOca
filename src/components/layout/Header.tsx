'use client';

import Image from 'next/image';
import type { DashboardFilters } from '@/types';

interface HeaderProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

export default function Header({}: HeaderProps) {
  return (
    <header className="flex items-center px-3 sm:px-6 py-4 sm:py-5 sticky top-0 z-30"
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
