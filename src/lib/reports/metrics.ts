/**
 * metrics.ts
 * Calcula PeriodMetrics y ComparisonMetrics a partir de registros diarios crudos.
 *
 * Fuentes de datos:
 *  - ventasRecords: registrosDiarios de /api/cierre-caja
 *    { fecha: YYYY-MM-DD, local: string, ventas: number }
 *  - gastosRecords: registrosDiariosGastos de /api/ventas
 *    { fecha: YYYY-MM-DD, sucursal: string, monto: number, proveedor: string }
 *
 * Reglas de fecha: siempre hora local (nunca UTC) — ver date-utils.ts.
 */

import { PeriodMetrics, ComparisonMetrics, ReportFilters } from './types';
import { toLocalDate, filterByDateRange, toLocalISODate } from '@/lib/date-utils';

// ── Tipos internos ────────────────────────────────────────────────────────────

export interface VentaRecord {
  fecha: string;
  local: string;
  ventas: number;
}

export interface GastoRecord {
  fecha: string;
  sucursal: string;
  monto: number;
  proveedor?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calcula delta porcentual con protección contra división por cero. */
function safeDeltaPct(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** Determina tendencia a partir del delta de ventas. */
function resolveTendencia(deltaVentas: number): 'up' | 'down' | 'flat' {
  if (deltaVentas > 2) return 'up';
  if (deltaVentas < -2) return 'down';
  return 'flat';
}

// ── calculatePeriodMetrics ────────────────────────────────────────────────────

/**
 * Calcula todas las métricas para un período dado.
 *
 * @param ventasRecords   registrosDiarios de /api/cierre-caja (todos los registros, sin filtrar)
 * @param gastosRecords   registrosDiariosGastos de /api/ventas (todos los registros, sin filtrar)
 * @param filters         { desde, hasta } en hora local; sucursal ('Todas' o nombre canónico)
 */
export function calculatePeriodMetrics(
  ventasRecords: VentaRecord[],
  gastosRecords: GastoRecord[],
  filters: { desde: Date | null; hasta: Date | null; sucursal: string },
): PeriodMetrics {
  const { desde, hasta, sucursal } = filters;
  const filterSucursal = sucursal && sucursal !== 'Todas';

  // ── Filtrar registros de ventas ──────────────────────────────────────────
  const filteredVentas = ventasRecords.filter(r => {
    if (filterSucursal && r.local !== sucursal) return false;
    const d = toLocalDate(r.fecha);
    return filterByDateRange(d, desde, hasta);
  });

  // ── Filtrar registros de gastos ──────────────────────────────────────────
  const filteredGastos = gastosRecords.filter(r => {
    if (filterSucursal && r.sucursal !== sucursal) return false;
    const d = toLocalDate(r.fecha);
    return filterByDateRange(d, desde, hasta);
  });

  // ── Totales globales ─────────────────────────────────────────────────────
  const totalVentas = filteredVentas.reduce((s, r) => s + r.ventas, 0);
  const totalGastos = filteredGastos.reduce((s, r) => s + r.monto, 0);
  const margen = totalVentas - totalGastos;
  const margenPct = totalVentas > 0 ? Math.round((margen / totalVentas) * 1000) / 10 : 0;

  // ── Transacciones y ticket promedio ────────────────────────────────────
  // Cada registro diario de cierre de caja = 1 cierre (1 "transacción" operativa).
  const transacciones = filteredVentas.length;
  const ticketPromedio = transacciones > 0 ? Math.round(totalVentas / transacciones) : 0;

  // ── Por sucursal ────────────────────────────────────────────────────────
  const porSucursal: PeriodMetrics['porSucursal'] = {};

  for (const r of filteredVentas) {
    const key = r.local;
    if (!porSucursal[key]) {
      porSucursal[key] = { ventas: 0, gastos: 0, margen: 0, transacciones: 0 };
    }
    porSucursal[key].ventas += r.ventas;
    porSucursal[key].transacciones += 1;
  }

  for (const r of filteredGastos) {
    const key = r.sucursal;
    if (!porSucursal[key]) {
      porSucursal[key] = { ventas: 0, gastos: 0, margen: 0, transacciones: 0 };
    }
    porSucursal[key].gastos += r.monto;
  }

  // Calcular margen por sucursal
  for (const key of Object.keys(porSucursal)) {
    const s = porSucursal[key];
    s.margen = s.ventas - s.gastos;
  }

  // ── Top productos (derivado de gastos por proveedor) ────────────────────
  const porProveedor: Record<string, number> = {};
  for (const r of filteredGastos) {
    const nombre = r.proveedor?.trim() || 'Sin proveedor';
    porProveedor[nombre] = (porProveedor[nombre] ?? 0) + r.monto;
  }

  const totalGastosPorProveedor = Object.values(porProveedor).reduce((s, v) => s + v, 0);

  const topProductos: PeriodMetrics['topProductos'] = Object.entries(porProveedor)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([nombre, monto]) => ({
      nombre,
      monto,
      pct: totalGastosPorProveedor > 0
        ? Math.round((monto / totalGastosPorProveedor) * 1000) / 10
        : 0,
    }));

  // ── Por día ──────────────────────────────────────────────────────────────
  const diaMap: Record<string, { ventas: number; gastos: number }> = {};

  for (const r of filteredVentas) {
    if (!diaMap[r.fecha]) diaMap[r.fecha] = { ventas: 0, gastos: 0 };
    diaMap[r.fecha].ventas += r.ventas;
  }

  for (const r of filteredGastos) {
    if (!diaMap[r.fecha]) diaMap[r.fecha] = { ventas: 0, gastos: 0 };
    diaMap[r.fecha].gastos += r.monto;
  }

  const porDia: PeriodMetrics['porDia'] = Object.entries(diaMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ventas: v.ventas, gastos: v.gastos }));

  return {
    ventas: totalVentas,
    gastos: totalGastos,
    margen,
    margenPct,
    transacciones,
    ticketPromedio,
    porSucursal,
    topProductos,
    porDia,
  };
}

// ── calculateComparison ───────────────────────────────────────────────────────

/**
 * Compara dos períodos y calcula deltas porcentuales y tendencia.
 */
export function calculateComparison(
  current: PeriodMetrics,
  previous: PeriodMetrics,
): ComparisonMetrics {
  const deltaVentas = safeDeltaPct(current.ventas, previous.ventas);
  const deltaGastos = safeDeltaPct(current.gastos, previous.gastos);
  const deltaMargen = safeDeltaPct(current.margen, previous.margen);
  const deltaTx = safeDeltaPct(current.transacciones, previous.transacciones);

  return {
    current,
    previous,
    deltaVentas,
    deltaGastos,
    deltaMargen,
    deltaTx,
    tendencia: resolveTendencia(deltaVentas),
  };
}

// ── buildPreviousPeriod ───────────────────────────────────────────────────────

/**
 * Construye el rango de fechas del período anterior con la misma duración,
 * inmediatamente antes del período actual.
 *
 * Ejemplo: si fechaDesde=2026-02-01 y fechaHasta=2026-02-28 (28 días),
 * el período anterior es 2026-01-04 → 2026-01-31 (28 días antes).
 */
export function buildPreviousPeriod(filters: ReportFilters): { desde: Date; hasta: Date } {
  const currentDesde = toLocalDate(filters.fechaDesde);
  const currentHasta = toLocalDate(filters.fechaHasta);

  // Si alguna fecha es inválida, devolver el mes anterior como fallback
  if (!currentDesde || !currentHasta) {
    const hoy = new Date();
    const hastaFallback = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);
    const desdeFallback = new Date(hastaFallback.getFullYear(), hastaFallback.getMonth(), 1, 0, 0, 0, 0);
    return { desde: desdeFallback, hasta: hastaFallback };
  }

  // Duración del período actual en días (inclusive)
  const msPerDay = 24 * 60 * 60 * 1000;
  const durationDays =
    Math.round((currentHasta.getTime() - currentDesde.getTime()) / msPerDay) + 1;

  // El período anterior termina el día inmediatamente antes del inicio del actual
  const hastaAnterior = new Date(
    currentDesde.getFullYear(),
    currentDesde.getMonth(),
    currentDesde.getDate() - 1,
    23, 59, 59, 999,
  );

  // Y empieza durationDays días antes de hastaAnterior (inclusive)
  const desdeAnterior = new Date(
    hastaAnterior.getFullYear(),
    hastaAnterior.getMonth(),
    hastaAnterior.getDate() - durationDays + 1,
    0, 0, 0, 0,
  );

  return { desde: desdeAnterior, hasta: hastaAnterior };
}

// ── toLocalISODate re-export (convenience) ────────────────────────────────────

/** Convierte un Date a YYYY-MM-DD en hora local. Útil para llamadores externos. */
export { toLocalISODate };
