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
import { parseMonto, parseFecha, getMesLabel, findHeader, normalizeProveedorName } from '@/lib/data/parsers';
import { withCacheSWR } from '@/lib/data/cache';
import { requireAuth } from '@/lib/auth-api';

const CACHE_KEY = 'ventas-v13';

/**
 * Factura que quedó fuera de los totales porque su fecha de vencimiento
 * (columna "FECHA EMITIDA") está vacía o mal cargada. Se reporta a la UI con el
 * número de fila para poder corregirla en la planilla.
 */
export interface FacturaSinFecha {
  sucursal: string;
  fila: number;         // número de fila real en la planilla
  proveedor: string;
  monto: number;
  fechaRecepcion: string;   // columna "Fecha", tal como está en la celda
  valorCelda: string;       // lo que hay en la celda de vencimiento (puede ser "", " ", "n"…)
}

async function fetchLocalVentas(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:Z5000`);
  if (rows.length < 2) return { registros: [], sinFecha: [] };

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
  const sinFecha: FacturaSinFecha[] = [];

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

    // Sin fecha válida no se puede imputar a ningún mes. En vez de perderla en
    // silencio se reporta con su número de fila para corregirla en la planilla.
    // dataRows[0] es la fila 2 de la planilla (la 1 son los encabezados).
    if (fecha.anio < 2020) {
      const monto = parseMonto(row[idx.monto] ?? '');
      // Sin monto no hay plata sin contabilizar: es una fila con basura en la
      // celda del total. Reportarla sería ruido para quien corrige la planilla.
      if (monto > 0) {
        sinFecha.push({
          sucursal:       nombre,
          fila:           i + 2,
          proveedor:      row[idx.proveedor] ?? '',
          monto,
          fechaRecepcion: (idxFechaFallback >= 0 ? row[idxFechaFallback] : '') ?? '',
          valorCelda:     (idxFechaEmitida >= 0 ? row[idxFechaEmitida] : '') ?? '',
        });
      }
      continue;
    }

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

  return { registros, sinFecha };
}

export async function fetchVentasData() {
  return withCacheSWR(CACHE_KEY, fetchVentasRaw);
}

async function fetchVentasRaw() {
  const locales = getLocalesConfig();

  const results = await Promise.allSettled(
    locales.map(l => fetchLocalVentas(l.nombre, l.id, l.tabs.facturas))
  );

  // Si algún local falló, tirar error en vez de seguir con lo parcial — ver
  // el comentario largo en cierre-caja/route.ts, mismo motivo acá: sin esto,
  // un hipo transitorio de la API de Sheets queda cacheado por withCacheSWR
  // como si fuera un resultado válido, hasta por 30 minutos.
  const fallidos = results
    .map((r, i) => (r.status === 'rejected' ? locales[i].nombre : null))
    .filter((n): n is string => n !== null);
  if (fallidos.length > 0) {
    throw new Error(`[ventas] Falló la lectura de: ${fallidos.join(', ')}`);
  }

  const fulfilled = results as PromiseFulfilledResult<Awaited<ReturnType<typeof fetchLocalVentas>>>[];
  const registros = fulfilled.flatMap(r => r.value.registros);
  const facturasSinFecha = fulfilled
    .flatMap(r => r.value.sinFecha)
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.fila - b.fila);
  if (facturasSinFecha.length) {
    const total = facturasSinFecha.reduce((s, f) => s + f.monto, 0);
    console.warn(`[ventas] ${facturasSinFecha.length} facturas sin fecha de vencimiento válida (${total}) — excluidas de los totales`);
  }

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
  // Unificar variantes tipeadas a mano antes de agrupar — ver normalizeProveedorName.
  const porProveedor: Record<string, number> = {};
  const proveedorNombre: Record<string, string> = {};
  for (const r of gastos) {
    const canonico = normalizeProveedorName(r.proveedor);
    const key = canonico.toLowerCase();
    if (!proveedorNombre[key]) proveedorNombre[key] = canonico;
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
    facturasSinFecha,
    ultimosRegistros: registros.slice(-10).reverse(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
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
