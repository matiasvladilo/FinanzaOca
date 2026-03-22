/**
 * POST /api/informes/ai-analysis
 * Genera análisis ejecutivo con IA a partir de los datos del informe.
 *
 * Body: { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, insights }
 * Response: { ok: true, analysis: { resumen, comparacion, problemas, recomendaciones } }
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Filters {
  fechaDesde: string;
  fechaHasta: string;
  sucursal?: string;
  tipo?: string;
}

interface PeriodMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  margenPct: number;
  transacciones: number;
  ticketPromedio: number;
  porSucursal: Record<string, { ventas: number; gastos: number; margen: number; transacciones: number }>;
  topProveedores: Array<{ nombre: string; monto: number; pct: number }>;
}

interface Insight {
  type: string;
  severity: string;
  titulo: string;
  descripcion: string;
  delta?: number;
  accion?: string;
}

interface MermaTipo {
  tipo: string;
  monto: number;
  pct: number;
}

interface MermaLocal {
  local: string;
  monto: number;
  pct: number;
}

interface MermaData {
  totalMerma: number;
  porTipo: MermaTipo[];
  porLocal: MermaLocal[];
}

interface TopProducto {
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
}

interface ProduccionData {
  topProductos: TopProducto[];
  totalPedidos: number;
}

interface AnalysisRequestBody {
  filters: Filters;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltaVentas: number;
  deltaGastos: number;
  deltaMargen: number;
  insights: Insight[];
  mermaData?: MermaData;
  produccionData?: ProduccionData;
}

interface AiAnalysis {
  resumen: string;
  comparacion: string;
  problemas: string[];
  recomendaciones: string[];
}

// ── Formato de pesos chilenos ─────────────────────────────────────────────────

function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

function fmt(n: number): string {
  return n.toFixed(1);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as AnalysisRequestBody;
    const { filters, current, previous, deltaVentas, deltaGastos, deltaMargen, insights, mermaData, produccionData } = body;

    if (!filters || !current || !previous) {
      return NextResponse.json(
        { ok: false, error: 'Body incompleto: se requieren filters, current y previous' },
        { status: 400 },
      );
    }

    const sucursalLabel = filters.sucursal ? `sucursal "${filters.sucursal}"` : 'todas las sucursales';
    const insightsText  = insights.map(i => `- [${i.type.toUpperCase()}/${i.severity}] ${i.titulo}: ${i.descripcion}${i.accion ? ` Acción sugerida: ${i.accion}` : ''}`).join('\n');

    const sucursalesTexto = Object.entries(current.porSucursal)
      .map(([nombre, d]) => `  - ${nombre}: ventas ${formatCLP(d.ventas)}, gastos ${formatCLP(d.gastos)}, margen ${formatCLP(d.margen)}`)
      .join('\n');

    const topProvText = current.topProveedores
      .map(p => `  - ${p.nombre}: ${formatCLP(p.monto)} (${fmt(p.pct)}% del total gastos top)`)
      .join('\n');

    // Merma
    let mermaTexto = '  (sin datos de merma)';
    if (mermaData && mermaData.totalMerma > 0) {
      const pctSobreVentas = current.ventas > 0
        ? ((mermaData.totalMerma / current.ventas) * 100).toFixed(1)
        : '—';
      const tiposTexto = mermaData.porTipo.slice(0, 4)
        .map(t => `    - ${t.tipo}: ${formatCLP(t.monto)} (${t.pct}%)`)
        .join('\n');
      const localesTexto = mermaData.porLocal
        .map(l => `    - ${l.local}: ${formatCLP(l.monto)} (${l.pct}%)`)
        .join('\n');
      mermaTexto = `Total merma: ${formatCLP(mermaData.totalMerma)} (${pctSobreVentas}% sobre ventas)\n  Por tipo:\n${tiposTexto}\n  Por local:\n${localesTexto}`;
    }

    // Producción
    let produccionTexto = '  (sin datos de producción)';
    if (produccionData && produccionData.topProductos.length > 0) {
      const prodTexto = produccionData.topProductos.slice(0, 8)
        .map((p, i) => `    ${i + 1}. ${p.nombre} (${p.categoria}): ${p.unidades} uds — ${formatCLP(p.ingresos)}`)
        .join('\n');
      produccionTexto = `Total pedidos: ${produccionData.totalPedidos}\n  Top productos por unidades vendidas:\n${prodTexto}`;
    }

    const prompt = `Eres el analista financiero de FinanzasOca, una cadena de locales gastronómicos en Chile. Analiza los siguientes datos del período y genera un informe ejecutivo en español claro y accionable.

PERÍODO ANALIZADO: ${filters.fechaDesde} al ${filters.fechaHasta} — ${sucursalLabel}

MÉTRICAS PERÍODO ACTUAL:
- Ventas totales:      ${formatCLP(current.ventas)}
- Gastos totales:      ${formatCLP(current.gastos)}
- Margen bruto:        ${formatCLP(current.margen)} (${fmt(current.margenPct)}%)
- Transacciones:       ${current.transacciones}
- Ticket promedio:     ${formatCLP(current.ticketPromedio)}

MÉTRICAS PERÍODO ANTERIOR:
- Ventas:              ${formatCLP(previous.ventas)}
- Gastos:              ${formatCLP(previous.gastos)}
- Margen:              ${formatCLP(previous.margen)} (${fmt(previous.margenPct)}%)
- Transacciones:       ${previous.transacciones}

VARIACIONES VS PERÍODO ANTERIOR:
- Δ Ventas:            ${fmt(deltaVentas)}%
- Δ Gastos:            ${fmt(deltaGastos)}%
- Δ Margen:            ${fmt(deltaMargen)}%

POR SUCURSAL (período actual):
${sucursalesTexto || '  (sin datos por sucursal)'}

TOP PROVEEDORES (período actual):
${topProvText || '  (sin datos de proveedores)'}

MERMA DEL PERÍODO:
  ${mermaTexto}

PRODUCCIÓN / TOP PRODUCTOS:
  ${produccionTexto}

ALERTAS DETECTADAS:
${insightsText || '  (sin alertas)'}

Genera un análisis ejecutivo ÚNICAMENTE en formato JSON válido con esta estructura exacta:
{
  "resumen": "párrafo de 2-3 oraciones con el estado general del negocio en el período",
  "comparacion": "párrafo de 2-3 oraciones comparando con el período anterior, destacando los cambios más relevantes",
  "problemas": ["problema 1 identificado", "problema 2 identificado"],
  "recomendaciones": ["acción concreta 1", "acción concreta 2", "acción concreta 3"]
}

REGLAS:
- Máximo 5 recomendaciones
- Máximo 4 problemas
- Lenguaje ejecutivo, directo y accionable
- Cifras en pesos chilenos (CLP) con formato "$X.XXX.XXX"
- Incluye en tu análisis observaciones sobre la merma (si es alta o controlada) y los productos más vendidos
- NO incluyas texto fuera del JSON
- NO uses markdown dentro del JSON
- El JSON debe ser parseable directamente`;

    const client = new Anthropic();

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extraer texto del primer bloque de contenido
    const rawContent = message.content[0];
    if (rawContent.type !== 'text') {
      return NextResponse.json({ ok: false, error: 'Respuesta inesperada de la IA' }, { status: 500 });
    }

    const rawText = rawContent.text.trim();

    // Parsear JSON — intentar extraer bloque JSON si hay texto extra
    let analysis: AiAnalysis;
    try {
      // Buscar primer { y último } para aislar el JSON
      const start = rawText.indexOf('{');
      const end   = rawText.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No se encontró JSON en la respuesta');
      const jsonStr = rawText.slice(start, end + 1);
      analysis = JSON.parse(jsonStr) as AiAnalysis;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'No se pudo parsear la respuesta de la IA como JSON', raw: rawText },
        { status: 500 },
      );
    }

    // Normalizar: asegurar arrays
    if (!Array.isArray(analysis.problemas))        analysis.problemas        = [];
    if (!Array.isArray(analysis.recomendaciones))  analysis.recomendaciones  = [];

    // Aplicar límites
    analysis.recomendaciones = analysis.recomendaciones.slice(0, 5);
    analysis.problemas       = analysis.problemas.slice(0, 4);

    return NextResponse.json({ ok: true, analysis });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
