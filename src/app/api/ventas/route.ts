/**
 * GET /api/ventas
 * Lee "Facturas" (gastos/ingresos) de los 4 locales en paralelo y combina.
 *
 * Fecha formal: FECHA EMITIDA (o "Fecha emitida") es la única fuente de verdad.
 * Si el sheet no tiene esa columna, se usa "Fecha" / "FECHA" como fallback.
 * Filas sin fecha válida se descartan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';
import { parseMonto, parseFecha, getMesLabel, findHeader } from '@/lib/data/parsers';
import { withCacheSWR } from '@/lib/data/cache';
import { requireAuth } from '@/lib/auth-api';

const CACHE_KEY = 'ventas-v12';

async function fetchLocalVentas(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:Z5000`);
  if (rows.length < 2) return [];

  const [headers, ...dataRows] = rows;

  // FECHA EMITIDA es la fecha formal para TODOS los locales.
  // Se buscan todas las variantes posibles de nombre de columna.
  const idxFechaEmitida = findHeader(
    headers,
    'FECHA EMITIDA', 'Fecha emitida', 'Fecha Emitida', 'fecha emitida',
    'FECHA_EMITIDA', 'FechaEmitida', 'Fecha de emisión', 'Fecha de Emisión',
    'FECHA DE EMISION', 'Fecha Emision', 'Emision', 'Emisión',
  );
  // Fallback solo para sheets que genuinamente no tienen columna de fecha emitida
  const idxFechaFallback = findHeader(headers, 'Fecha', 'FECHA', 'fecha');

  // Log para verificar qué columna se usa en cada local
  const fechaColName = idxFechaEmitida >= 0 ? headers[idxFechaEmitida] : (idxFechaFallback >= 0 ? headers[idxFechaFallback] : 'NO ENCONTRADA');
  console.log(`[ventas] ${nombre} → fecha formal: "${fechaColName}" (col ${idxFechaEmitida >= 0 ? idxFechaEmitida : idxFechaFallback})`);

  const idx = {
    tipo:      findHeader(headers, 'Tipo (Ingreso/Gasto)'),
    subtipo:   findHeader(headers, 'Subtipo Doc'),
    proveedor: findHeader(headers, 'Proveedor/Cliente', 'Proveedores', 'Proveedor', 'proveedor'),
    medioPago: findHeader(headers, 'Medio de Pago'),
    monto:     findHeader(headers, 'Total Factura', 'Monto', 'Columna 8', 'Total'),
  };

  const registros: {
    id: number; sucursal: string; tipo: string; subtipo: string;
    proveedor: string; medioPago: string; monto: number;
    fecha: string; mes: number; anio: number;
  }[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row[idx.monto]) continue;

    let fecha;
    if (idxFechaEmitida >= 0) {
      // El sheet tiene columna FECHA EMITIDA — usarla estrictamente, sin fallback
      fecha = parseFecha(row[idxFechaEmitida] ?? '');
    } else {
      // El sheet no tiene columna FECHA EMITIDA — usar "Fecha" como única alternativa
      fecha = idxFechaFallback >= 0 ? parseFecha(row[idxFechaFallback] ?? '') : { anio: 0, mes: 0, dia: 0, iso: '', date: null };
    }

    // Descartar filas sin fecha válida
    if (fecha.anio < 2020) continue;

    registros.push({
      id:        i + 1,
      sucursal:  nombre,
      tipo:      (row[idx.tipo] ?? 'GASTO').toUpperCase(),
      subtipo:   row[idx.subtipo]   ?? '',
      proveedor: row[idx.proveedor] ?? '',
      medioPago: row[idx.medioPago] ?? '',
      monto:     parseMonto(row[idx.monto] ?? ''),
      fecha:     fecha.iso,   // ISO basado en FECHA EMITIDA
      mes:       fecha.mes,
      anio:      fecha.anio,
    });
  }

  return registros;
}

export async function fetchVentasData() {
  return withCacheSWR(CACHE_KEY, fetchVentasRaw);
}

async function fetchVentasRaw() {
  const locales = getLocalesConfig();

  const results = await Promise.allSettled(
    locales.map(l => fetchLocalVentas(l.nombre, l.id, l.tabs.facturas))
  );

  const registros = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`[ventas] Error leyendo ${locales[i].nombre}:`, r.reason);
    return [];
  });

  if (registros.length === 0) return null;

  // Gastos = TODAS las filas de facturas (el sheet suma GASTO+INGRESO sin filtrar por tipo)
  const gastos   = registros; // todas las filas
  const ingresos = registros.filter(r => r.tipo === 'INGRESO');
  const totalGastos   = gastos.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);

  const ANIO_ACTUAL = new Date().getFullYear();

  // ── Por mes ─────────────────────────────────────────────────────────────
  const porMes: Record<string, { mes: number; anio: number; ventas: number; gastos: number }> = {};
  for (const r of registros) {
    if (r.anio > ANIO_ACTUAL) continue; // descartar fechas futuras
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, gastos: 0 };
    porMes[key].gastos += r.monto; // suma todo (GASTO + INGRESO = total facturas)
  }

  const chartData = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), ventas: v.ventas, gastos: v.gastos }));

  const gastosPorMes: Record<string, number> = {};
  for (const [key, v] of Object.entries(porMes)) gastosPorMes[key] = v.gastos;

  // ── Por sucursal ────────────────────────────────────────────────────────
  const porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }> = {};
  for (const r of registros) {
    if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, transacciones: 0 };
    porSucursal[r.sucursal].gastos += r.monto; // total facturas (GASTO+INGRESO)
    porSucursal[r.sucursal].transacciones++;
  }

  // ── Gastos por mes + sucursal (para filtrar gráfico por local) ───────────
  const gastosPorMesSucursal: Record<string, Record<string, number>> = {};
  for (const r of registros) {
    if (r.anio > ANIO_ACTUAL) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!gastosPorMesSucursal[r.sucursal]) gastosPorMesSucursal[r.sucursal] = {};
    gastosPorMesSucursal[r.sucursal][key] = (gastosPorMesSucursal[r.sucursal][key] ?? 0) + r.monto;
  }

  // ── Top proveedores ─────────────────────────────────────────────────────
  const porProveedor: Record<string, number> = {};
  const proveedorNombre: Record<string, string> = {};
  for (const r of gastos) {
    const key = r.proveedor.toLowerCase();
    if (!proveedorNombre[key]) proveedorNombre[key] = r.proveedor;
    porProveedor[key] = (porProveedor[key] ?? 0) + r.monto;
  }
  const topProveedores = Object.entries(porProveedor)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([key, monto]) => ({ nombre: proveedorNombre[key], monto }));

  // ── Por medio de pago ───────────────────────────────────────────────────
  const porMedioPago: Record<string, number> = {};
  for (const r of gastos) {
    porMedioPago[r.medioPago] = (porMedioPago[r.medioPago] ?? 0) + r.monto;
  }

  const registrosDiariosGastos = gastos
    .filter(r => r.fecha)
    .map(r => ({
      fecha: r.fecha,
      mesKey: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
      sucursal: r.sucursal,
      monto: r.monto,
      proveedor: r.proveedor,
      subtipo: r.subtipo,
    }));

  return {
    kpi: {
      totalGastos,
      totalIngresos,
      margen: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0,
      totalTransacciones: registros.length,
    },
    chartData,
    gastosPorMes,
    gastosPorMesSucursal,
    porSucursal,
    topProveedores,
    porMedioPago,
    registrosDiariosGastos,
    ultimosRegistros: registros.slice(-10).reverse(),
  };
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    // Si viene un ?tab= personalizado, leer sin caché (caso especial)
    const { searchParams } = new URL(req.url);
    if (searchParams.get('tab')) {
      const data = await fetchVentasData();
      if (!data) return NextResponse.json({ ok: true, registros: [], kpi: null, chartData: [] });
      return NextResponse.json({ ok: true, ...data });
    }

    const data = await fetchVentasData();
    if (!data) return NextResponse.json({ ok: true, registros: [], kpi: null, chartData: [] });
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
