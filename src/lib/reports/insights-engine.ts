/**
 * insights-engine.ts
 * Motor de insights basado en reglas para FinanzaOca.
 *
 * Reglas implementadas:
 *  1. Caída de ventas > 10% vs período anterior → negative
 *  2. Spike de ventas > 20% vs período anterior → positive
 *  3. Margen < 15%  → warning
 *  4. Margen negativo → negative
 *  5. Proveedor/sucursal única con > 60% del total → warning (dependencia)
 *  6. Delta absoluto de ventas por sucursal (caída > 10% o subida > 20%)
 *
 * Los insights se ordenan por severidad: negative → warning → positive → neutral.
 */

import { ComparisonMetrics, Insight, InsightSeverity } from './types';

// ── Orden de severidad para sorting ──────────────────────────────────────────

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  negative: 0,
  warning:  1,
  positive: 2,
  neutral:  3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ── Reglas individuales ───────────────────────────────────────────────────────

/** Regla 1 & 2: Tendencia global de ventas (caída o spike). */
function ruleVentasTendencia(comparison: ComparisonMetrics): Insight | null {
  const { deltaVentas, current, previous } = comparison;

  if (deltaVentas <= -10) {
    return {
      id: 'ventas-caida-global',
      type: 'ventas',
      severity: 'negative',
      titulo: 'Caída significativa de ventas',
      descripcion: `Las ventas bajaron un ${Math.abs(deltaVentas).toFixed(1)}% respecto al período anterior (de $${fmt(previous.ventas)} a $${fmt(current.ventas)}).`,
      valor: current.ventas,
      delta: deltaVentas,
      accion: 'Revisar causas operativas: días sin cierre, baja en tráfico o problemas de registro.',
    };
  }

  if (deltaVentas >= 20) {
    return {
      id: 'ventas-spike-global',
      type: 'ventas',
      severity: 'positive',
      titulo: 'Crecimiento destacado en ventas',
      descripcion: `Las ventas crecieron un ${deltaVentas.toFixed(1)}% versus el período anterior (de $${fmt(previous.ventas)} a $${fmt(current.ventas)}).`,
      valor: current.ventas,
      delta: deltaVentas,
      accion: 'Identificar los factores del crecimiento para replicarlos.',
    };
  }

  return null;
}

/** Regla 3 & 4: Margen bajo o negativo. */
function ruleMargen(comparison: ComparisonMetrics): Insight | null {
  const { margenPct, margen, ventas, gastos } = comparison.current;

  if (margen < 0) {
    return {
      id: 'margen-negativo',
      type: 'margen',
      severity: 'negative',
      titulo: 'Margen negativo: los gastos superan las ventas',
      descripcion: `Los gastos ($${fmt(gastos)}) superan las ventas ($${fmt(ventas)}) en $${fmt(Math.abs(margen))}. Margen: ${margenPct.toFixed(1)}%.`,
      valor: margenPct,
      delta: comparison.deltaMargen,
      accion: 'Auditar gastos del período. Verificar si hay facturas duplicadas o extraordinarias.',
    };
  }

  if (margenPct < 15 && ventas > 0) {
    return {
      id: 'margen-bajo',
      type: 'margen',
      severity: 'warning',
      titulo: 'Margen por debajo del objetivo (15%)',
      descripcion: `El margen actual es ${margenPct.toFixed(1)}% (ventas $${fmt(ventas)}, gastos $${fmt(gastos)}). El objetivo mínimo es 15%.`,
      valor: margenPct,
      delta: comparison.deltaMargen,
      accion: 'Revisar los principales proveedores y evaluar oportunidades de reducción de costos.',
    };
  }

  return null;
}

/** Regla 5: Dependencia de una única sucursal (> 60% del total de ventas). */
function ruleDependenciaSucursal(comparison: ComparisonMetrics): Insight | null {
  const { current } = comparison;
  if (current.ventas === 0) return null;

  for (const [nombre, data] of Object.entries(current.porSucursal)) {
    const pct = (data.ventas / current.ventas) * 100;
    if (pct > 60) {
      return {
        id: `dependencia-sucursal-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'dependencia',
        severity: 'warning',
        titulo: `Alta concentración en ${nombre}`,
        descripcion: `${nombre} representa el ${pct.toFixed(1)}% de las ventas totales ($${fmt(data.ventas)} de $${fmt(current.ventas)}). Concentración excesiva.`,
        valor: pct,
        accion: `Monitorear la continuidad operativa de ${nombre} y evaluar crecimiento en otras sucursales.`,
      };
    }
  }

  return null;
}

/** Regla 5b: Dependencia de un único proveedor (> 60% del total de gastos). */
function ruleDependenciaProveedor(comparison: ComparisonMetrics): Insight | null {
  const { current } = comparison;
  if (current.gastos === 0 || current.topProductos.length === 0) return null;

  const top = current.topProductos[0];
  if (top.pct > 60) {
    return {
      id: `dependencia-proveedor-${top.nombre.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
      type: 'dependencia',
      severity: 'warning',
      titulo: `Alta concentración en proveedor "${top.nombre}"`,
      descripcion: `"${top.nombre}" representa el ${top.pct.toFixed(1)}% del total de gastos ($${fmt(top.monto)} de $${fmt(current.gastos)}).`,
      valor: top.pct,
      accion: 'Diversificar proveedores para reducir riesgo de abastecimiento y mejorar poder de negociación.',
    };
  }

  return null;
}

/** Regla 6: Deltas por sucursal (caída > 10% o spike > 20%). */
function ruleSucursalesDelta(comparison: ComparisonMetrics): Insight[] {
  const insights: Insight[] = [];
  const { current, previous } = comparison;

  const allSucursales = new Set([
    ...Object.keys(current.porSucursal),
    ...Object.keys(previous.porSucursal),
  ]);

  for (const nombre of allSucursales) {
    const curr = current.porSucursal[nombre]?.ventas ?? 0;
    const prev = previous.porSucursal[nombre]?.ventas ?? 0;

    if (prev === 0 && curr === 0) continue;

    const delta = prev === 0
      ? (curr > 0 ? 100 : 0)
      : Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;

    if (delta <= -10) {
      insights.push({
        id: `ventas-caida-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'tendencia',
        severity: 'negative',
        titulo: `Caída de ventas en ${nombre}`,
        descripcion: `${nombre} bajó un ${Math.abs(delta).toFixed(1)}% (de $${fmt(prev)} a $${fmt(curr)}).`,
        valor: curr,
        delta,
        accion: `Verificar cierres y operación de ${nombre} en el período.`,
      });
    } else if (delta >= 20) {
      insights.push({
        id: `ventas-spike-${nombre.toLowerCase().replace(/\s+/g, '-')}`,
        type: 'tendencia',
        severity: 'positive',
        titulo: `Crecimiento destacado en ${nombre}`,
        descripcion: `${nombre} creció un ${delta.toFixed(1)}% (de $${fmt(prev)} a $${fmt(curr)}).`,
        valor: curr,
        delta,
        accion: `Analizar los factores de crecimiento en ${nombre} para replicarlos.`,
      });
    }
  }

  return insights;
}

/** Regla 7: Insight de tendencia de margen comparada con período anterior. */
function ruleMargenTendencia(comparison: ComparisonMetrics): Insight | null {
  const { deltaMargen, current, previous } = comparison;

  // Solo reportar si cambió significativamente y los datos son válidos
  if (
    previous.ventas === 0 ||
    current.ventas === 0 ||
    Math.abs(deltaMargen) < 10
  ) return null;

  if (deltaMargen <= -15) {
    return {
      id: 'margen-tendencia-caida',
      type: 'margen',
      severity: 'warning',
      titulo: 'Deterioro del margen vs período anterior',
      descripcion: `El margen cambió de ${previous.margenPct.toFixed(1)}% a ${current.margenPct.toFixed(1)}% (${fmtPct(deltaMargen)} de variación).`,
      valor: current.margenPct,
      delta: deltaMargen,
      accion: 'Comparar estructura de costos entre ambos períodos e identificar incrementos extraordinarios.',
    };
  }

  if (deltaMargen >= 15) {
    return {
      id: 'margen-tendencia-mejora',
      type: 'margen',
      severity: 'positive',
      titulo: 'Mejora del margen vs período anterior',
      descripcion: `El margen mejoró de ${previous.margenPct.toFixed(1)}% a ${current.margenPct.toFixed(1)}% (${fmtPct(deltaMargen)} de variación).`,
      valor: current.margenPct,
      delta: deltaMargen,
    };
  }

  return null;
}

// ── generateInsights (export principal) ──────────────────────────────────────

/**
 * Genera todos los insights aplicando las reglas en orden.
 * Devuelve el array ordenado por severidad: negative → warning → positive → neutral.
 */
export function generateInsights(comparison: ComparisonMetrics): Insight[] {
  const candidates: (Insight | null)[] = [
    ruleVentasTendencia(comparison),
    ruleMargen(comparison),
    ruleDependenciaSucursal(comparison),
    ruleDependenciaProveedor(comparison),
    ruleMargenTendencia(comparison),
    ...ruleSucursalesDelta(comparison),
  ];

  const insights = candidates.filter((i): i is Insight => i !== null);

  // Ordenar por severidad (negative primero) y luego por valor absoluto del delta
  return insights.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
  });
}
