'use client';

import { useState } from 'react';
import { MapPin, Download, ChevronDown, Sun, Moon, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import type { DashboardFilters } from '@/types';
import { useTheme } from '@/providers/ThemeProvider';

interface HeaderProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onExport?: () => void;
  sucursalesDisponibles?: string[];
}

const THEME_META = {
  light:   { icon: <Moon   className="w-4 h-4" />, label: 'Modo claro',   next: 'Oscuro'  },
  dark:    { icon: <Sun    className="w-4 h-4" />, label: 'Modo oscuro',  next: 'Dracula' },
  dracula: { icon: <Sparkles className="w-4 h-4" />, label: 'Dracula',   next: 'Claro'   },
} as const;

export default function Header({ filters, onFiltersChange, onExport, sucursalesDisponibles }: HeaderProps) {
  const [sucursalOpen, setSucursalOpen] = useState(false);
  const { theme, cycle } = useTheme();

  const SUCURSALES = sucursalesDisponibles ?? ['Todas'];
  const meta = THEME_META[theme];

  const setVista = (vista: 'overview' | 'granular') =>
    onFiltersChange({ ...filters, vista });

  const setSucursal = (sucursal: string) => {
    onFiltersChange({ ...filters, sucursal });
    setSucursalOpen(false);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-30 transition-colors"
      style={{ background: 'var(--header-bg)', borderColor: 'var(--border)' }}>

      <h1 className="text-[18px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
        Data Analytics Desk
      </h1>

      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center rounded-full p-1 gap-1" style={{ background: 'var(--hover)' }}>
          {(['overview', 'granular'] as const).map(v => (
            <button key={v}
              onClick={() => setVista(v)}
              className={clsx('px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150')}
              style={filters.vista === v
                ? { background: 'var(--card)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--text-3)' }}
            >
              {v === 'overview' ? 'Overview' : 'Granular'}
            </button>
          ))}
        </div>

        {/* Sucursal Selector */}
        <div className="relative">
          <button onClick={() => setSucursalOpen(!sucursalOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-[12px] border transition-colors hover:border-[var(--active-text)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}>
            <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
            <span>{filters.sucursal === 'Todas' ? 'Todas las sucursales' : filters.sucursal}</span>
            <ChevronDown className="w-3 h-3" style={{ color: 'var(--text-3)' }} />
          </button>

          {sucursalOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSucursalOpen(false)} />
              <div className="absolute right-0 top-full mt-1 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px] border"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                {SUCURSALES.map((s) => (
                  <button key={s} onClick={() => setSucursal(s)}
                    className="w-full text-left px-4 py-2.5 text-[12px] transition-colors"
                    style={filters.sucursal === s
                      ? { color: 'var(--active-text)', background: 'var(--active-bg)', fontWeight: 600 }
                      : { color: 'var(--text-2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = filters.sucursal === s ? 'var(--active-bg)' : '')}>
                    {s === 'Todas' ? 'Todas las sucursales' : s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Theme toggle — cycles light → dark → dracula */}
        <button onClick={cycle}
          title={`Cambiar a ${meta.next}`}
          className="w-9 h-9 flex items-center justify-center rounded-full border transition-all hover:border-[var(--active-text)] hover:text-[var(--active-text)]"
          style={{ background: 'var(--card)', borderColor: 'var(--border-2)', color: 'var(--text-3)' }}>
          {meta.icon}
        </button>

        {/* Export */}
        <button onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold transition-colors shadow-sm"
          style={{ background: 'var(--active-text)', color: '#ffffff' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
      </div>
    </header>
  );
}
