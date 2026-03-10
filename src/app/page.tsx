'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import AlertBanner from '@/components/dashboard/AlertBanner';
import KPICards from '@/components/dashboard/KPICards';
import DailyPerformanceChart from '@/components/dashboard/DailyPerformanceChart';
import DistributionTreemap from '@/components/dashboard/DistributionTreemap';
import SKUTable from '@/components/dashboard/SKUTable';
import OperationalEfficiency from '@/components/dashboard/OperationalEfficiency';
import type { DashboardFilters, Sucursal } from '@/types';
import { toast } from '@/components/ui/Toast';
import { exportToCSV } from '@/lib/csv-export';
import {
  kpiData,
  dailyData,
  distribucionSucursales,
  topProductos,
  eficienciaOperacional,
} from '@/lib/mock-data';

// Datos filtrados por sucursal
const dataPorSucursal: Record<Sucursal, typeof distribucionSucursales> = {
  Todas: distribucionSucursales,
  PV: [{ nombre: 'PV', valor: 18900000, porcentaje: 100, color: '#2563EB' }],
  'La Reina': [{ nombre: 'La Reina', valor: 12400000, porcentaje: 100, color: '#3B82F6' }],
  PT: [{ nombre: 'PT', valor: 8500000, porcentaje: 100, color: '#60A5FA' }],
  Bilbao: [{ nombre: 'Bilbao', valor: 5400000, porcentaje: 100, color: '#93C5FD' }],
};

const eficienciaPorSucursal: Record<Sucursal, typeof eficienciaOperacional> = {
  Todas: eficienciaOperacional,
  PV: [{ sucursal: 'PV', fi: 88, color: '#EF4444' }],
  'La Reina': [{ sucursal: 'La Reina', fi: 34, color: '#22C55E' }],
  PT: [{ sucursal: 'PT', fi: 55, color: '#3B82F6' }],
  Bilbao: [{ sucursal: 'Bilbao', fi: 48, color: '#3B82F6' }],
};

const defaultFilters: DashboardFilters = {
  fechaInicio: '2024-06-01',
  fechaFin: '2024-06-30',
  sucursal: 'Todas',
  vista: 'overview',
};

export default function DashboardPage() {
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);

  const treemapData = dataPorSucursal[filters.sucursal] ?? distribucionSucursales;
  const eficienciaData = eficienciaPorSucursal[filters.sucursal] ?? eficienciaOperacional;

  // Filtrar productos por sucursal (simulado)
  const productosFiltrados = useMemo(() => {
    if (filters.sucursal === 'Todas') return topProductos;
    return topProductos.slice(0, 3); // Simula menos productos por sucursal
  }, [filters.sucursal]);

  const handleExport = () => {
    exportToCSV(
      topProductos.map(p => ({
        Producto: p.nombre,
        ID: p.id,
        Unidades: p.unidades,
        'Ingresos Brutos': p.ingresosBrutos,
        'Tendencia %': p.tendencia,
      })),
      'dashboard_resumen'
    );
    toast('Reporte exportado correctamente');
  };

  return (
    <div className="flex flex-col flex-1">
      <Header
        filters={filters}
        onFiltersChange={setFilters}
        onExport={handleExport}
      />

      <main className="flex-1 px-6 py-5 space-y-5 pb-8">
        {/* Alert */}
        <AlertBanner />

        {/* KPI Cards */}
        <KPICards data={kpiData} />

        {/* Indicador de vista */}
        {filters.vista === 'granular' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-[12px] text-blue-700 font-medium">
              Vista Granular activa — mostrando desglose detallado por día
            </p>
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2">
            <DailyPerformanceChart
              data={dailyData}
              chartType={filters.vista === 'granular' ? 'line' : 'bar'}
            />
          </div>
          <div className="col-span-1">
            <DistributionTreemap
              data={treemapData}
              onSucursalClick={(nombre) => {
                const s = nombre as Sucursal;
                setFilters(f => ({ ...f, sucursal: f.sucursal === s ? 'Todas' : s }));
                toast(`Filtrando por ${nombre}`, 'info');
              }}
              activeSucursal={filters.sucursal}
            />
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-5 pb-6">
          <div className="col-span-2">
            <SKUTable data={productosFiltrados} />
          </div>
          <div className="col-span-1">
            <OperationalEfficiency data={eficienciaData} />
          </div>
        </div>
      </main>
    </div>
  );
}
