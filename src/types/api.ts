/**
 * api.ts
 * Tipos compartidos para las respuestas de los endpoints /api/*.
 * Importar desde aquí en lugar de redefinir en cada página.
 */

// ── Cierre de Caja (/api/cierre-caja) ────────────────────────────────────────

export interface CierreCajaKPI {
  totalVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransf: number;
  totalCierres: number;
}

export interface CierreCajaChartPoint {
  fecha: string;
  ventas: number;
  efectivo: number;
  tarjeta: number;
  transf: number;
}

export interface LocalSlice {
  ventas: number;
  efectivo: number;
  tarjeta: number;
  transf: number;
  cierres: number;
}

export interface MedioPago {
  efectivo: number;
  tarjeta: number;
  transf: number;
}

export interface CierreCajaResponse {
  ok: boolean;
  kpi: CierreCajaKPI | null;
  chartData: CierreCajaChartPoint[];
  porLocal: Record<string, LocalSlice>;
  porLocalMes: Record<string, Record<string, Omit<LocalSlice, 'cierres'>>>;
  mesesDisponibles: string[];
  medioPago: MedioPago;
  registrosDiarios: {
    fecha: string;
    local: string;
    ventas: number;
    efectivo: number;
    tarjeta: number;
    transf: number;
  }[];
}

// ── Ventas / Gastos (/api/ventas) ─────────────────────────────────────────────

export interface VentasKPI {
  totalGastos: number;
  totalIngresos: number;
  margen: number;
  totalTransacciones: number;
}

export interface VentasChartPoint {
  fecha: string;
  ventas: number;
  gastos: number;
}

export interface SucursalSlice {
  ventas: number;
  gastos: number;
  transacciones: number;
}

export interface VentasResponse {
  ok: boolean;
  kpi: VentasKPI | null;
  chartData: VentasChartPoint[];
  gastosPorMes: Record<string, number>;
  gastosPorMesSucursal: Record<string, Record<string, number>>;
  porSucursal: Record<string, SucursalSlice>;
  topProveedores: { nombre: string; monto: number }[];
  porMedioPago: Record<string, number>;
  registrosDiariosGastos: { fecha: string; sucursal: string; monto: number }[];
}

// ── Merma (/api/merma-data) ───────────────────────────────────────────────────

export interface MermaKPI {
  totalMerma: number;
  totalRegistros: number;
  tipoMasFrecuente: string;
  montoMayor: number;
}

export interface MermaTipo {
  nombre: string;
  monto: number;
  porcentaje: number;
  color: string;
}

export interface MermaRegistro {
  id: number;
  producto: string;
  tipo: string;
  monto: number;
  fecha: string;
  local: string;
}

export interface MermaResponse {
  ok: boolean;
  kpi: MermaKPI | null;
  chartData: { fecha: string; monto: number }[];
  porTipo: MermaTipo[];
  ultimosRegistros: MermaRegistro[];
  locales: string[];
  filtros: { local: string; periodo: string };
}

// ── Analytics (/api/analytics/insights) ──────────────────────────────────────

export type InsightType = 'trend' | 'ranking' | 'anomaly' | 'comparison' | 'info';
export type InsightSeverity = 'positive' | 'negative' | 'neutral' | 'warning';
export type InsightMetric = 'ventas' | 'gastos' | 'merma' | 'utilidad' | 'ordenes';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  metric: InsightMetric;
  period: string;
  local?: string;
  value?: number;
  delta?: number;
  conclusion: string;
  generatedAt: string;
}

export interface InsightsResponse {
  ok: boolean;
  insights: Insight[];
  period: string;
}
