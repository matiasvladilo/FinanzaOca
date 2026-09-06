'use client';

import { Sun, Moon, Sparkles } from 'lucide-react';
import type { DashboardFilters } from '@/types';
import { useTheme } from '@/providers/ThemeProvider';

interface HeaderProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  title?: string;
}

const THEME_META = {
  light:   { icon: <Moon   className="w-4 h-4" />, label: 'Modo claro',   next: 'Oscuro'  },
  dark:    { icon: <Sun    className="w-4 h-4" />, label: 'Modo oscuro',  next: 'Dracula' },
  dracula: { icon: <Sparkles className="w-4 h-4" />, label: 'Dracula',   next: 'Claro'   },
} as const;

export default function Header({ title = 'Data Analytics Desk' }: HeaderProps) {
  const { theme, cycle } = useTheme();
  const meta = THEME_META[theme];

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b sticky top-0 z-30 transition-colors"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>

      <h1 className="text-[14px] sm:text-[18px] font-bold tracking-tight shrink-0" style={{ color: 'var(--text)' }}>
        {title}
      </h1>

      <div className="flex items-center gap-1 sm:gap-3">
        {/* Theme toggle — cycles light → dark → dracula */}
        <button onClick={cycle}
          title={`Cambiar a ${meta.next}`}
          className="w-9 h-9 flex items-center justify-center rounded-full border transition-all hover:border-[var(--active-text)] hover:text-[var(--active-text)]"
          style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
          {meta.icon}
        </button>
      </div>
    </header>
  );
}
