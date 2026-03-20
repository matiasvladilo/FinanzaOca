/**
 * types.ts
 * Tipos compartidos para la capa de reportes de FinanzaOca.
 * Usados por metrics.ts, insights-engine.ts, ai-agent.ts y las páginas de reporte.
 */

export interface ReportFilters {
  fechaDesde: string; // YYYY-MM-DD
  fechaHasta: string; // YYYY-MM-DD
  sucursal: string;   // 'Todas' | 'PV' | 'La Reina' | 'PT' | 'Bilbao'
  tipo: 'completo' | 'resumen';
}

export interface PeriodMetrics {
  ventas: number;
  gastos: number;
  margen: number;         // valor absoluto (ventas - gastos)
  margenPct: number;      // porcentaje sobre ventas
  transacciones: number;
  ticketPromedio: number;
  porSucursal: Record<string, {
    ventas: number;
    gastos: number;
    margen: number;
    transacciones: number;
  }>;
  topProductos: Array<{ nombre: string; monto: number; pct: number }>;
  porDia: Array<{ fecha: string; ventas: number; gastos: number }>;
}

export interface ComparisonMetrics {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaVentas: number;      // cambio porcentual vs período anterior
  deltaGastos: number;
  deltaMargen: number;
  deltaTx: number;
  tendencia: 'up' | 'down' | 'flat';
}

export type InsightSeverity = 'positive' | 'negative' | 'warning' | 'neutral';
export type InsightType = 'ventas' | 'margen' | 'dependencia' | 'tendencia' | 'anomalia';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  titulo: string;
  descripcion: string;
  valor?: number;
  delta?: number;
  accion?: string;
}

export interface AIAnalysis {
  resumen: string;
  comparacion: string;
  problemas: string[];
  recomendaciones: string[];
  generatedAt: string;
}

export interface ReportData {
  filters: ReportFilters;
  generatedAt: string;
  metrics: ComparisonMetrics;
  insights: Insight[];
  aiAnalysis: AIAnalysis | null;
}
