/**
 * trends.ts
 * Funciones puras para cálculo de tendencias financieras.
 * No depende de Google Sheets — consume datos ya normalizados.
 */

import type { Insight } from '@/types/api';

interface LocalVentas {
  nombre: string;
  ventasMesActual: number;
  ventasMesAnterior: number;
}

/**
 * Genera insights de tendencia comparando el mes actual con el anterior.
 * @param locales  Array con ventas de cada local en ambos períodos
 * @param periodo  Clave "YYYY-MM" del mes analizado
 */
export function computeTrendInsights(locales: LocalVentas[], periodo: string): Insight[] {
  const insights: Insight[] = [];

  for (const local of locales) {
    const { nombre, ventasMesActual, ventasMesAnterior } = local;
    if (!ventasMesAnterior || !ventasMesActual) continue;

    const delta = ((ventasMesActual - ventasMesAnterior) / ventasMesAnterior) * 100;
    const absDelta = Math.abs(delta);

    // Solo reportar si el cambio es significativo (>5%)
    if (absDelta < 5) continue;

    const positive = delta > 0;
    insights.push({
      id: `trend-${nombre}-${periodo}`,
      type: 'trend',
      severity: positive ? 'positive' : (absDelta > 20 ? 'negative' : 'warning'),
      metric: 'ventas',
      period: periodo,
      local: nombre,
      value: ventasMesActual,
      delta: Math.round(delta * 10) / 10,
      conclusion: positive
        ? `${nombre} subió sus ventas un ${absDelta.toFixed(1)}% respecto al mes anterior.`
        : `${nombre} bajó sus ventas un ${absDelta.toFixed(1)}% respecto al mes anterior.`,
      generatedAt: new Date().toISOString(),
    });
  }

  return insights.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
}

/**
 * Calcula el margen (ventas - gastos) y genera insight si es negativo o bajo.
 */
export function computeMarginInsight(
  totalVentas: number,
  totalGastos: number,
  periodo: string,
): Insight | null {
  if (!totalVentas) return null;
  const margen = ((totalVentas - totalGastos) / totalVentas) * 100;

  if (margen > 30) return null; // margen saludable, no alertar

  return {
    id: `margin-${periodo}`,
    type: 'info',
    severity: margen < 0 ? 'negative' : margen < 15 ? 'warning' : 'neutral',
    metric: 'utilidad',
    period: periodo,
    value: Math.round(margen * 10) / 10,
    delta: Math.round(margen * 10) / 10,
    conclusion: margen < 0
      ? `Margen negativo en ${periodo}: los gastos superan las ventas.`
      : `Margen neto del ${margen.toFixed(1)}% — por debajo del objetivo.`,
    generatedAt: new Date().toISOString(),
  };
}
