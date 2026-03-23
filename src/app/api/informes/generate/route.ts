/**
 * GET /api/informes/generate
 * Genera un informe de gestión para un período y sucursal dados.
 *
 * Query params:
 *   fechaDesde  YYYY-MM-DD
 *   fechaHasta  YYYY-MM-DD
 *   sucursal    nombre del local (o vacío para todos)
 *   tipo        "daily" | "weekly" | "monthly" (informativo, no filtra)
 */

import { NextRequest, NextResponse } from 'next/server';
import { toLocalDate, filterByDateRange, toLocalISODate } from '@/lib/date-utils';
import { requireAuth } from '@/lib/auth-api';
import { fetchCierreCajaData } from '@/app/api/cierre-caja/route';
import { fetchVentasData } from '@/app/api/ventas/route';
import { fetchMermaForReport, MermaReportData } from '@/app/api/merma-data/route';
import { fetchTopProductosForReport, ProduccionReportData } from '@/app/api/produccion-data/route';
import { fetchGastoFijoForReport, GastoFijoData } from '@/lib/gasto-fijo';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface RegistroDiario {
  fecha: string;
  local: string;
  ventas: number;
}

interface RegistroGasto {
  fecha: string;
  sucursal: string;
  monto: number;
  proveedor: string;
}

interface CierreCajaResponse {
  ok: boolean;
  registrosDiarios?: RegistroDiario[];
}

interface VentasResponse {
  ok: boolean;
  registrosDiariosGastos?: RegistroGasto[];
  topProveedores?: Array<{ nombre: string; monto: number }>;
}

interface SucursalMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  transacciones: number;
}

interface PeriodMetrics {
  ventas: number;
  gastos: number;
  margen: number;
  margenPct: number;
  transacciones: number;
  ticketPromedio: number;
  porSucursal: Record<string, SucursalMetrics>;
  topProveedores: Array<{ nombre: string; monto: number; pct: number }>;
  porDia: Array<{ fecha: string; ventas: number; gastos: number }>;
}

interface Insight {
  id: string;
  type: 'positive' | 'negative' | 'warning';
  severity: 'high' | 'medium' | 'low';
  titulo: string;
  descripcion: string;
  valor?: number;
  delta?: number;
  accion?: string;
}

// ── Helpers de fecha para el período anterior ─────────────────────────────────

function offsetDate(isoDate: string, days: number): string {
  const d = toLocalDate(isoDate);
  if (!d) return isoDate;
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
  return toLocalISODate(result);
}

function daysBetween(isoFrom: string, isoTo: string): number {
  const from = toLocalDate(isoFrom);
  const to = toLocalDate(isoTo);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Cálculo de métricas por período ──────────────────────────────────────────

function calcMetrics(
  registros: RegistroDiario[],
  gastos: RegistroGasto[],
  desde: Date | null,
  hasta: Date | null,
  sucursal: string,
  allProveedores: Array<{ nombre: string; monto: number }>,
): PeriodMetrics {
  // Filtrar ventas (cierre-caja)
  const ventasFiltradas = registros.filter(r => {
    const d = toLocalDate(r.fecha);
    if (!filterByDateRange(d, desde, hasta)) return false;
    if (sucursal && r.local !== sucursal) return false;
    return true;
  });

  // Filtrar gastos (ventas/facturas)
  const gastosFiltrados = gastos.filter(r => {
    const d = toLocalDate(r.fecha);
    if (!filterByDateRange(d, desde, hasta)) return false;
    if (sucursal && r.sucursal !== sucursal) return false;
    return true;
  });

  const totalVentas = ventasFiltradas.reduce((s, r) => s + r.ventas, 0);
  const totalGastos = gastosFiltrados.reduce((s, r) => s + r.monto, 0);
  const margen = totalVentas - totalGastos;
  const margenPct = totalVentas > 0 ? (margen / totalVentas) * 100 : 0;

  // Transacciones = número de registros de cierre de caja en el período
  const transacciones = ventasFiltradas.length;
  const ticketPromedio = transacciones > 0 ? totalVentas / transacciones : 0;

  // Por sucursal
  const porSucursal: Record<string, SucursalMetrics> = {};
  for (const r of ventasFiltradas) {
    if (!porSucursal[r.local]) porSucursal[r.local] = { ventas: 0, gastos: 0, margen: 0, transacciones: 0 };
    porSucursal[r.local].ventas += r.ventas;
    porSucursal[r.local].transacciones++;
  }
  for (const r of gastosFiltrados) {
    if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, margen: 0, transacciones: 0 };
    porSucursal[r.sucursal].gastos += r.monto;
  }
  for (const nombre of Object.keys(porSucursal)) {
    porSucursal[nombre].margen = porSucursal[nombre].ventas - porSucursal[nombre].gastos;
  }

  // Top proveedores en el período (re-calcular desde registros filtrados)
  const proveedorMap: Record<string, number> = {};
  for (const r of gastosFiltrados) {
    const key = r.proveedor.toLowerCase();
    proveedorMap[key] = (proveedorMap[key] ?? 0) + r.monto;
  }
  const proveedorNombres: Record<string, string> = {};
  for (const r of gastosFiltrados) {
    const key = r.proveedor.toLowerCase();
    if (!proveedorNombres[key]) proveedorNombres[key] = r.proveedor;
  }
  // Si no hay datos en el período, usar top global como referencia
  const topProveedoresSrc = Object.keys(proveedorMap).length > 0
    ? Object.entries(proveedorMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([key, monto]) => ({ nombre: proveedorNombres[key] ?? key, monto }))
    : allProveedores.slice(0, 5);

  const totalGastosTop = topProveedoresSrc.reduce((s, p) => s + p.monto, 0);
  const topProveedores = topProveedoresSrc.map(p => ({
    nombre: p.nombre,
    monto: p.monto,
    pct: totalGastosTop > 0 ? (p.monto / totalGastosTop) * 100 : 0,
  }));

  // Por día (unificado ventas + gastos)
  const porDiaMap: Record<string, { ventas: number; gastos: number }> = {};
  for (const r of ventasFiltradas) {
    if (!porDiaMap[r.fecha]) porDiaMap[r.fecha] = { ventas: 0, gastos: 0 };
    porDiaMap[r.fecha].ventas += r.ventas;
  }
  for (const r of gastosFiltrados) {
    if (!porDiaMap[r.fecha]) porDiaMap[r.fecha] = { ventas: 0, gastos: 0 };
    porDiaMap[r.fecha].gastos += r.monto;
  }
  const porDia = Object.entries(porDiaMap)
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
    topProveedores,
    porDia,
  };
}

// ── Generación de insights ────────────────────────────────────────────────────

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function generateInsights(
  current: PeriodMetrics,
  previous: PeriodMetrics,
  deltaVentas: number,
  deltaGastos: number,
  deltaMargen: number,
  deltaTx: number,
): Insight[] {
  const insights: Insight[] = [];
  let idSeq = 0;
  const nextId = (prefix: string) => `${prefix}-${++idSeq}`;

  // Ventas globales
  if (deltaVentas < -10) {
    insights.push({
      id: nextId('ventas'),
      type: 'negative',
      severity: deltaVentas < -25 ? 'high' : 'medium',
      titulo: 'Caída de ventas',
      descripcion: `Las ventas cayeron un ${Math.abs(deltaVentas).toFixed(1)}% respecto al período anterior.`,
      valor: current.ventas,
      delta: deltaVentas,
      accion: 'Revisar causas operativas o estacionales y reforzar acciones comerciales.',
    });
  } else if (deltaVentas > 10) {
    insights.push({
      id: nextId('ventas'),
      type: 'positive',
      severity: 'low',
      titulo: 'Crecimiento de ventas',
      descripcion: `Las ventas crecieron un ${deltaVentas.toFixed(1)}% respecto al período anterior.`,
      valor: current.ventas,
      delta: deltaVentas,
    });
  }

  // Margen
  if (current.margenPct < 0) {
    insights.push({
      id: nextId('margen'),
      type: 'negative',
      severity: 'high',
      titulo: 'Margen negativo',
      descripcion: `El margen es negativo (${current.margenPct.toFixed(1)}%). Los gastos superan las ventas del período.`,
      valor: current.margen,
      delta: deltaMargen,
      accion: 'Auditar gastos del período e identificar egresos extraordinarios.',
    });
  } else if (current.margenPct < 15) {
    insights.push({
      id: nextId('margen'),
      type: 'warning',
      severity: 'medium',
      titulo: 'Margen bajo',
      descripcion: `El margen es del ${current.margenPct.toFixed(1)}%, por debajo del umbral saludable del 15%.`,
      valor: current.margen,
      delta: deltaMargen,
      accion: 'Evaluar estructura de costos y posibilidades de optimización.',
    });
  }

  // Alta dependencia de una sucursal
  const totalVentas = current.ventas;
  if (totalVentas > 0) {
    for (const [nombre, data] of Object.entries(current.porSucursal)) {
      const pct = (data.ventas / totalVentas) * 100;
      if (pct > 60) {
        insights.push({
          id: nextId('dependencia'),
          type: 'warning',
          severity: 'medium',
          titulo: 'Alta dependencia de sucursal',
          descripcion: `"${nombre}" concentra el ${pct.toFixed(1)}% de las ventas totales del período.`,
          valor: pct,
          accion: 'Diversificar esfuerzos comerciales en otras sucursales para reducir riesgo.',
        });
      }
    }
  }

  // Caída por sucursal individual
  for (const [nombre, dataCurrent] of Object.entries(current.porSucursal)) {
    const dataPrev = previous.porSucursal[nombre];
    if (!dataPrev || dataPrev.ventas === 0) continue;
    const delta = pctDelta(dataCurrent.ventas, dataPrev.ventas);
    if (delta < -15) {
      insights.push({
        id: nextId(`suc-${nombre}`),
        type: 'negative',
        severity: delta < -30 ? 'high' : 'medium',
        titulo: `Caída de ventas en ${nombre}`,
        descripcion: `Las ventas de "${nombre}" cayeron un ${Math.abs(delta).toFixed(1)}% respecto al período anterior.`,
        valor: dataCurrent.ventas,
        delta,
        accion: `Revisar operaciones y actividad comercial en la sucursal ${nombre}.`,
      });
    }
  }

  // Gastos creciendo más rápido que ventas
  if (deltaGastos > deltaVentas + 10 && deltaGastos > 5) {
    insights.push({
      id: nextId('gastos'),
      type: 'warning',
      severity: 'medium',
      titulo: 'Gastos creciendo más rápido que ventas',
      descripcion: `Los gastos crecieron ${deltaGastos.toFixed(1)}% mientras las ventas lo hicieron ${deltaVentas.toFixed(1)}%.`,
      valor: current.gastos,
      delta: deltaGastos,
      accion: 'Identificar y controlar los principales conductores del alza de gastos.',
    });
  }

  // Ticket promedio cayendo
  if (deltaTx > 0 && deltaVentas < deltaTx - 10) {
    const deltaTicket = pctDelta(current.ticketPromedio, previous.ticketPromedio);
    if (deltaTicket < -10) {
      insights.push({
        id: nextId('ticket'),
        type: 'warning',
        severity: 'low',
        titulo: 'Ticket promedio en descenso',
        descripcion: `El ticket promedio cayó un ${Math.abs(deltaTicket).toFixed(1)}% pese a mayor volumen de transacciones.`,
        valor: current.ticketPromedio,
        delta: deltaTicket,
        accion: 'Revisar mix de productos y estrategias de upselling.',
      });
    }
  }

  return insights;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Permitir llamadas internas desde el cron autenticadas con x-cron-secret
  const cronHeader = req.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const isCronCall = cronSecret && cronHeader === cronSecret;

  let perms: ReturnType<typeof import('@/lib/auth').getPermissions>;
  if (isCronCall) {
    const { getPermissions } = await import('@/lib/auth');
    const cronRole = (req.headers.get('x-cron-role') ?? 'usuario') as import('@/lib/auth').Role;
    perms = getPermissions(cronRole);
  } else {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;
    const { getPermissions } = await import('@/lib/auth');
    perms = getPermissions(user.role);
  }

  try {
    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde') ?? '';
    const fechaHasta = searchParams.get('fechaHasta') ?? '';
    const sucursal   = searchParams.get('sucursal') ?? '';
    const tipo       = searchParams.get('tipo') ?? 'custom';

    // Validar fechas
    if (!fechaDesde || !fechaHasta) {
      return NextResponse.json(
        { ok: false, error: 'fechaDesde y fechaHasta son obligatorios (YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    // Obtener datos en paralelo (cierre-caja, ventas, merma, producción, gasto fijo)
    const [ccResult, ventasResult, mermaResult, produccionResult, gastoFijoResult] = await Promise.allSettled([
      fetchCierreCajaData(),
      fetchVentasData(),
      fetchMermaForReport(fechaDesde, fechaHasta),
      fetchTopProductosForReport(fechaDesde, fechaHasta),
      perms.canAccessGastoFijo ? fetchGastoFijoForReport(fechaDesde, fechaHasta) : Promise.resolve({ porLocal: [], totalGeneral: 0 } as GastoFijoData),
    ]);

    const ccData      = ccResult.status      === 'fulfilled' ? ccResult.value      : null;
    const ventasData  = ventasResult.status  === 'fulfilled' ? ventasResult.value  : null;
    const mermaData   = mermaResult.status   === 'fulfilled' ? mermaResult.value   : { totalMerma: 0, porTipo: [], porLocal: [] } as MermaReportData;
    const produccionData = produccionResult.status === 'fulfilled' ? produccionResult.value : { topProductos: [], totalPedidos: 0 } as ProduccionReportData;
    const gastoFijoData  = gastoFijoResult.status  === 'fulfilled' ? gastoFijoResult.value  : { porLocal: [], totalGeneral: 0 } as GastoFijoData;

    const registrosDiarios       = ccData?.registrosDiarios          ?? [];
    const registrosDiariosGastos = ventasData?.registrosDiariosGastos ?? [];
    const allProveedores         = ventasData?.topProveedores          ?? [];

    // Período actual
    const currDesde = toLocalDate(fechaDesde);
    const currHasta = (() => {
      const d = toLocalDate(fechaHasta);
      if (!d) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    })();

    // Período anterior: misma duración inmediatamente antes de fechaDesde
    const duration = daysBetween(fechaDesde, fechaHasta) + 1; // inclusive
    const prevHastaStr  = offsetDate(fechaDesde, -1);
    const prevDesdeStr  = offsetDate(prevHastaStr, -(duration - 1));
    const prevDesde = toLocalDate(prevDesdeStr);
    const prevHasta = (() => {
      const d = toLocalDate(prevHastaStr);
      if (!d) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    })();

    // Calcular métricas
    const current  = calcMetrics(registrosDiarios, registrosDiariosGastos, currDesde, currHasta, sucursal, allProveedores);
    const previous = calcMetrics(registrosDiarios, registrosDiariosGastos, prevDesde, prevHasta, sucursal, allProveedores);

    // Deltas porcentuales
    const deltaVentas = pctDelta(current.ventas, previous.ventas);
    const deltaGastos = pctDelta(current.gastos, previous.gastos);
    const deltaMargen = pctDelta(current.margen, previous.margen);
    const deltaTx     = pctDelta(current.transacciones, previous.transacciones);

    // Tendencia global
    const tendencia: 'up' | 'down' | 'flat' =
      deltaVentas > 5 ? 'up' : deltaVentas < -5 ? 'down' : 'flat';

    // Insights
    const insights = generateInsights(current, previous, deltaVentas, deltaGastos, deltaMargen, deltaTx);

    // Proyección de ventas — solo cuando el período termina hoy y quedan días en el mes
    const todayStr = toLocalISODate(new Date());
    const esHoy = fechaHasta === todayStr;
    const diasConData = current.porDia.filter(d => d.ventas > 0).length || 1;
    const promedioDiario = current.ventas / diasConData;
    const fechaHastaDate = toLocalDate(fechaHasta) ?? new Date();
    const diasTotalesMes = new Date(fechaHastaDate.getFullYear(), fechaHastaDate.getMonth() + 1, 0).getDate();
    const diaDelMes = fechaHastaDate.getDate();
    const diasRestantesMes = Math.max(diasTotalesMes - diaDelMes, 0);
    const duracionPeriodo = daysBetween(fechaDesde, fechaHasta) + 1;
    const proyeccion = (esHoy && diasRestantesMes > 0) ? {
      diasTranscurridos: diasConData,
      promedioDiario,
      diasRestantesMes,
      diasTotalesMes,
      diaDelMes,
      ventasProyectadasMes: current.ventas + promedioDiario * diasRestantesMes,
      duracionPeriodo,
      ventasProyectadasSiguiente: promedioDiario * duracionPeriodo,
    } : null;

    return NextResponse.json({
      ok: true,
      filters: { fechaDesde, fechaHasta, sucursal, tipo },
      generatedAt: new Date().toISOString(),
      periodoAnterior: { fechaDesde: prevDesdeStr, fechaHasta: prevHastaStr },
      current,
      previous,
      deltaVentas,
      deltaGastos,
      deltaMargen,
      deltaTx,
      tendencia,
      insights,
      mermaData,
      produccionData,
      gastoFijoData,
      proyeccion,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
