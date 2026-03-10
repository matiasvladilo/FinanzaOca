import type { KPIData, DailyData, SucursalDistribucion, ProductoSKU, EficienciaOperacional } from '@/types';

export const kpiData: KPIData = {
  ventasBrutas: 45200000,
  opexTotal: 12400000,
  rendimientoNeto: 27.43,
  factorIndex: 52.1,
};

export const dailyData: DailyData[] = [
  { dia: 'LUN 01', ventas: 5200000, gastos: 2100000 },
  { dia: 'MAR 02', ventas: 3800000, gastos: 1800000 },
  { dia: 'MIE 03', ventas: 4500000, gastos: 1900000 },
  { dia: 'JUE 04', ventas: 7200000, gastos: 3400000 },
  { dia: 'VIE 05', ventas: 6100000, gastos: 2800000 },
  { dia: 'SAB 06', ventas: 8600000, gastos: 3200000 },
  { dia: 'DOM 07', ventas: 6800000, gastos: 2600000 },
];

export const distribucionSucursales: SucursalDistribucion[] = [
  { nombre: 'PV', valor: 18900000, porcentaje: 42, color: '#2563EB' },
  { nombre: 'La Reina', valor: 12400000, porcentaje: 27, color: '#3B82F6' },
  { nombre: 'PT', valor: 8500000, porcentaje: 19, color: '#60A5FA' },
  { nombre: 'Bilbao', valor: 5400000, porcentaje: 12, color: '#93C5FD' },
];

export const topProductos: ProductoSKU[] = [
  { id: 'SK-22049', nombre: 'Pan de Molde Premium', unidades: 1240, ingresosBrutos: 8680000, tendencia: 8.2 },
  { id: 'SK-22055', nombre: 'Combo Desayuno XXL', unidades: 980, ingresosBrutos: 5880000, tendencia: 4.5 },
  { id: 'SK-11023', nombre: 'Pack Bebidas Artesanal', unidades: 2450, ingresosBrutos: 4900000, tendencia: -2.1 },
  { id: 'SK-33012', nombre: 'Hallulla Integral', unidades: 3200, ingresosBrutos: 4200000, tendencia: 6.7 },
  { id: 'SK-44087', nombre: 'Marraqueta Clásica', unidades: 5100, ingresosBrutos: 3800000, tendencia: 1.2 },
];

export const eficienciaOperacional: EficienciaOperacional[] = [
  { sucursal: 'PV', fi: 88, color: '#EF4444' },
  { sucursal: 'La Reina', fi: 34, color: '#22C55E' },
  { sucursal: 'PT', fi: 55, color: '#3B82F6' },
  { sucursal: 'Bilbao', fi: 48, color: '#3B82F6' },
];

export const formatCLP = (valor: number): string => {
  if (valor >= 1000000) {
    return `$${(valor / 1000000).toFixed(1)}M`;
  }
  if (valor >= 1000) {
    return `$${(valor / 1000).toFixed(0)}k`;
  }
  return `$${valor.toLocaleString('es-CL')}`;
};

export const formatCLPFull = (valor: number): string => {
  return `$${valor.toLocaleString('es-CL')}`;
};
