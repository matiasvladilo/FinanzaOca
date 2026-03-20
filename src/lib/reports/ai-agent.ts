/**
 * ai-agent.ts
 * Análisis ejecutivo con IA usando Anthropic SDK.
 *
 * Solo para uso server-side (route handlers, server components).
 * La clave ANTHROPIC_API_KEY debe estar en las variables de entorno.
 */

import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { ComparisonMetrics, Insight, AIAnalysis, ReportFilters } from './types';

// ── Helpers de formateo ───────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ── buildPrompt ───────────────────────────────────────────────────────────────

function buildPrompt(
  filters: ReportFilters,
  metrics: ComparisonMetrics,
  insights: Insight[],
): string {
  const { current, previous } = metrics;

  // ── Resumen de sucursales del período actual ──────────────────────────────
  const sucursalesLines = Object.entries(current.porSucursal)
    .sort(([, a], [, b]) => b.ventas - a.ventas)
    .map(([nombre, data]) =>
      `  - ${nombre}: ventas $${fmt(data.ventas)}, gastos $${fmt(data.gastos)}, margen $${fmt(data.margen)} (${data.transacciones} cierres)`,
    )
    .join('\n');

  // ── Top proveedores del período actual ───────────────────────────────────
  const productosLines = current.topProductos.slice(0, 5)
    .map(p => `  - ${p.nombre}: $${fmt(p.monto)} (${p.pct.toFixed(1)}%)`)
    .join('\n');

  // ── Insights generados ───────────────────────────────────────────────────
  const insightsLines = insights
    .map(i => `  [${i.severity.toUpperCase()}] ${i.titulo}: ${i.descripcion}`)
    .join('\n');

  const deltaDesc = (delta: number) =>
    `${fmtPct(delta)} vs período anterior`;

  return `Eres un analista financiero ejecutivo de FinanzaOca, una empresa chilena de restaurantes/cafeterías con sucursales PV, La Reina, PT y Bilbao. Analiza los siguientes datos del período ${filters.fechaDesde} al ${filters.fechaHasta}${filters.sucursal !== 'Todas' ? ` (sucursal: ${filters.sucursal})` : ''} y entrega un análisis ejecutivo conciso y accionable en español.

═══════════════════════════════════════════
PERÍODO ACTUAL: ${filters.fechaDesde} → ${filters.fechaHasta}
═══════════════════════════════════════════
Ventas totales:        $${fmt(current.ventas)}  (${deltaDesc(metrics.deltaVentas)})
Gastos totales:        $${fmt(current.gastos)}  (${deltaDesc(metrics.deltaGastos)})
Margen bruto:          $${fmt(current.margen)} / ${current.margenPct.toFixed(1)}%  (${deltaDesc(metrics.deltaMargen)})
Cierres de caja:       ${current.transacciones}  (${deltaDesc(metrics.deltaTx)})
Ticket promedio:       $${fmt(current.ticketPromedio)}
Tendencia:             ${metrics.tendencia === 'up' ? 'ALZA' : metrics.tendencia === 'down' ? 'BAJA' : 'ESTABLE'}

PERÍODO ANTERIOR (comparación):
Ventas:    $${fmt(previous.ventas)}
Gastos:    $${fmt(previous.gastos)}
Margen:    $${fmt(previous.margen)} / ${previous.margenPct.toFixed(1)}%
Cierres:   ${previous.transacciones}

POR SUCURSAL (período actual):
${sucursalesLines || '  (sin datos por sucursal)'}

TOP PROVEEDORES/GASTOS (período actual):
${productosLines || '  (sin datos de proveedores)'}

═══════════════════════════════════════════
ALERTAS E INSIGHTS DETECTADOS (${insights.length}):
═══════════════════════════════════════════
${insightsLines || '  Sin alertas significativas.'}

═══════════════════════════════════════════
INSTRUCCIONES:
═══════════════════════════════════════════
Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin markdown, sin texto adicional):

{
  "resumen": "Párrafo ejecutivo de 2-3 oraciones sobre el desempeño del período. Incluye los números más relevantes.",
  "comparacion": "Párrafo de 2-3 oraciones comparando con el período anterior. Destaca lo más significativo.",
  "problemas": [
    "Problema o riesgo 1 identificado (máximo 2 oraciones)",
    "Problema o riesgo 2"
  ],
  "recomendaciones": [
    "Recomendación accionable 1 (qué hacer, quién, cuándo)",
    "Recomendación accionable 2",
    "Recomendación accionable 3"
  ]
}

Restricciones:
- Máximo 5 recomendaciones
- Máximo 4 problemas
- Lenguaje ejecutivo directo, sin adornos
- Montos siempre en pesos chilenos (CLP) con formato $X.XXX
- Si los datos son escasos o vacíos, indicarlo claramente en el resumen
- No inventes datos ni hagas suposiciones sin respaldo en los números`;
}

// ── generateAIAnalysis ────────────────────────────────────────────────────────

/**
 * Genera análisis ejecutivo con IA para el período dado.
 *
 * Requiere ANTHROPIC_API_KEY en el entorno.
 * Lanza un error si la API falla o la respuesta no es JSON válido.
 */
export async function generateAIAnalysis(
  filters: ReportFilters,
  metrics: ComparisonMetrics,
  insights: Insight[],
): Promise<AIAnalysis> {
  const client = new Anthropic();

  const prompt = buildPrompt(filters, metrics, insights);

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extraer texto de la respuesta
  const rawContent = message.content[0];
  if (rawContent.type !== 'text') {
    throw new Error('[ai-agent] Respuesta inesperada: el content block no es texto.');
  }

  const rawText = rawContent.text.trim();

  // Parsear JSON — puede venir envuelto en ```json ... ``` si el modelo lo añade
  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: {
    resumen?: string;
    comparacion?: string;
    problemas?: unknown[];
    recomendaciones?: unknown[];
  };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`[ai-agent] No se pudo parsear la respuesta JSON. Texto recibido: ${rawText.slice(0, 300)}`);
  }

  // Validar y normalizar campos
  const resumen = typeof parsed.resumen === 'string' ? parsed.resumen.trim() : 'Análisis no disponible.';
  const comparacion = typeof parsed.comparacion === 'string' ? parsed.comparacion.trim() : 'Sin comparación disponible.';

  const problemas = Array.isArray(parsed.problemas)
    ? parsed.problemas
        .filter((p): p is string => typeof p === 'string')
        .slice(0, 4)
    : [];

  const recomendaciones = Array.isArray(parsed.recomendaciones)
    ? parsed.recomendaciones
        .filter((r): r is string => typeof r === 'string')
        .slice(0, 5)
    : [];

  return {
    resumen,
    comparacion,
    problemas,
    recomendaciones,
    generatedAt: new Date().toISOString(),
  };
}
