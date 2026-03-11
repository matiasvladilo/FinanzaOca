'use client';

import { useState } from 'react';
import { MapPin, Download, ChevronDown, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';
import type { DashboardFilters } from '@/types';
import { useTheme } from '@/providers/ThemeProvider';

interface HeaderProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onExport?: () => void;
  sucursalesDisponibles?: string[];
}

export default function Header({ filters, onFiltersChange, onExport, sucursalesDisponibles }: HeaderProps) {
  const [sucursalOpen, setSucursalOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const SUCURSALES = sucursalesDisponibles ?? ['Todas'];

  const setVista = (vista: 'overview' | 'granular') => {
    onFiltersChange({ ...filters, vista });
  };

  const setSucursal = (sucursal: string) => {
    onFiltersChange({ ...filters, sucursal });
    setSucursalOpen(false);
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
      {/* Title */}
      <h1 className="text-[18px] font-bold text-gray-900 dark:text-white tracking-tight">
        Data Analytics Desk
      </h1>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1">
          <button
            onClick={() => setVista('overview')}
            className={clsx(
              'px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150',
              filters.vista === 'overview'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setVista('granular')}
            className={clsx(
              'px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150',
              filters.vista === 'granular'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            Granular View
          </button>
        </div>

        {/* Sucursal Selector */}
        <div className="relative">
          <button
            onClick={() => setSucursalOpen(!sucursalOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-[12px] text-gray-700 dark:text-gray-300 hover:border-blue-400 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span>{filters.sucursal === 'Todas' ? 'Todas las sucursales' : filters.sucursal}</span>
            <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          </button>

          {sucursalOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSucursalOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50 min-w-[180px]">
                {SUCURSALES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSucursal(s)}
                    className={clsx(
                      'w-full text-left px-4 py-2.5 text-[12px] transition-colors',
                      filters.sucursal === s
                        ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {s === 'Todas' ? 'Todas las sucursales' : s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[12px] font-semibold transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
      </div>
    </header>
  );
}
