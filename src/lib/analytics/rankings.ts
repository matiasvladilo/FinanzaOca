/**
 * rankings.ts
 * Funciones puras para rankings de locales.
 * No depende de Google Sheets — consume datos ya normalizados.
 */

import type { Insight } from '@/types/api';

interface LocalData {
  nombre: string;
  ventas: number;
}

/**
 * Identifica el local con más ventas y genera un insight positivo.
 */
export function computeTopLocalInsight(locales: LocalData[], periodo: string): Insight | null {
  const withVentas = locales.filter(l => l.ventas > 0);
  if (withVentas.length < 2) return null;

  const sorted = [...withVentas].sort((a, b) => b.ventas - a.ventas);
  const top = sorted[0];
  const second = sorted[1];
  const diff = top.ventas - second.ventas;
  const pct = second.ventas > 0 ? Math.round((diff / second.ventas) * 100) : 0;

  return {
    id: `top-local-${periodo}`,
    type: 'ranking',
    severity: 'positive',
    metric: 'ventas',
    period: periodo,
    local: top.nombre,
    value: top.ventas,
    conclusion: `${top.nombre} lidera en ventas${pct > 0 ? `, superando a ${second.nombre} por un ${pct}%` : ''}.`,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Identifica el local con menor rendimiento.
 */
export function computeBottomLocalInsight(locales: LocalData[], periodo: string): Insight | null {
  const withVentas = locales.filter(l => l.ventas > 0);
  if (withVentas.length < 2) return null;

  const sorted = [...withVentas].sort((a, b) => a.ventas - b.ventas);
  const bottom = sorted[0];

  return {
    id: `bottom-local-${periodo}`,
    type: 'ranking',
    severity: 'warning',
    metric: 'ventas',
    period: periodo,
    local: bottom.nombre,
    value: bottom.ventas,
    conclusion: `${bottom.nombre} registra las ventas más bajas del período.`,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Genera todos los insights de ranking para un período.
 */
export function computeRankingInsights(locales: LocalData[], periodo: string): Insight[] {
  const insights: Insight[] = [];

  const top = computeTopLocalInsight(locales, periodo);
  if (top) insights.push(top);

  const bottom = computeBottomLocalInsight(locales, periodo);
  if (bottom) insights.push(bottom);

  return insights;
}
