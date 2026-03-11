/**
 * Sucursal es string abierto para soportar nuevos locales dinámicamente.
 * 'Todas' es el valor especial para "sin filtro".
 */
export type Sucursal = string;

export interface KPIData {
  ventasBrutas: number;
  opexTotal: number;
  rendimientoNeto: number;
  factorIndex: number;
}

export interface DailyData {
  dia: string;
  ventas: number;
  gastos: number;
}

export interface SucursalDistribucion {
  nombre: string;
  valor: number;
  porcentaje: number;
  color: string;
}

export interface ProductoSKU {
  id: string;
  nombre: string;
  unidades: number;
  ingresosBrutos: number;
  tendencia: number;
}

export interface EficienciaOperacional {
  sucursal: string;
  fi: number;
  color: string;
}

export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  sucursal: Sucursal;
  vista: 'overview' | 'granular';
}
