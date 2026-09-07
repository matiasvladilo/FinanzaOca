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
import { hoyISOChile } from '@/lib/date-utils';

const CACHE_KEY = 'ventas-v14';

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

export interface RegistroFactura {
  id: number; sucursal: string; tipo: string; subtipo: string;
  proveedor: string; medioPago: string; monto: number;
  fecha: string; mes: number; anio: number;
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

  const registros: RegistroFactura[] = [];
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

export interface GastosAgregados {
  kpi: { totalGastos: number; totalIngresos: number; margen: number; totalTransacciones: number };
  chartData: { fecha: string; ventas: number; gastos: number }[];
  gastosPorMes: Record<string, number>;
  gastosPorMesSucursal: Record<string, Record<string, number>>;
  porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }>;
  topProveedores: { nombre: string; monto: number }[];
  porMedioPago: Record<string, number>;
}

/**
 * Agrega un array de facturas (ya filtrado por quien llama — "hasta hoy" o
 * "mes completo") en el mismo shape que espera el resto de la app. Se llama
 * dos veces desde `fetchVentasRaw`, una por cada variante, para poder
 * ofrecer el toggle "Total / Hasta hoy" sin duplicar esta lógica.
 */
export function agregarGastos(
  gastos: RegistroFactura[],
  totalTransacciones: number,
  anioActual: number,
): GastosAgregados {
  const ingresos      = gastos.filter(r => r.tipo === 'INGRESO');
  const totalGastos   = gastos.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);

  const porMes: Record<string, { mes: number; anio: number; ventas: number; gastos: number }> = {};
  for (const r of gastos) {
    if (r.anio > anioActual) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, gastos: 0 };
    porMes[key].gastos += r.monto;
  }
  const chartData = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), ventas: v.ventas, gastos: v.gastos }));
  const gastosPorMes: Record<string, number> = {};
  for (const [key, v] of Object.entries(porMes)) gastosPorMes[key] = v.gastos;

  const porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }> = {};
  for (const r of gastos) {
    if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, transacciones: 0 };
    porSucursal[r.sucursal].gastos += r.monto;
    porSucursal[r.sucursal].transacciones++;
  }

  const gastosPorMesSucursal: Record<string, Record<string, number>> = {};
  for (const r of gastos) {
    if (r.anio > anioActual) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!gastosPorMesSucursal[r.sucursal]) gastosPorMesSucursal[r.sucursal] = {};
    gastosPorMesSucursal[r.sucursal][key] = (gastosPorMesSucursal[r.sucursal][key] ?? 0) + r.monto;
  }

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

  const porMedioPago: Record<string, number> = {};
  for (const r of gastos) {
    porMedioPago[r.medioPago] = (porMedioPago[r.medioPago] ?? 0) + r.monto;
  }

  return {
    kpi: {
      totalGastos,
      totalIngresos,
      margen: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0,
      totalTransacciones,
    },
    chartData,
    gastosPorMes,
    gastosPorMesSucursal,
    porSucursal,
    topProveedores,
    porMedioPago,
  };
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

  const HOY_ISO = hoyISOChile();
  const ANIO_ACTUAL = new Date().getFullYear();

  // `gastosCrudo`: TODAS las filas, sin filtrar — la usa registrosDiariosGastos
  // (informes/asistente cortan por su propio rango de fechas explícito) y
  // ahora también la variante "mes completo" del toggle.
  //
  // `gastosHastaHoy`: excluye facturas con FECHA EMITIDA futura — proveedores
  // como el arriendo o servicios ya quedan cargados en la planilla con su
  // fecha de vencimiento del mes completo desde el día 1, aunque falten
  // semanas para que "pasen". Sin este corte, el mes en curso suma sus
  // gastos completos contra sólo los días de venta que ya ocurrieron (la
  // caja no tiene "ventas futuras"), e infla el Factor Índice / Margen Neto
  // de forma irreal (ej. 376% en vez de ~97% el día 4 de un mes de 30). Es
  // el comportamiento default de siempre — sigue siendo lo que exponen los
  // campos planos de la respuesta.
  const gastosCrudo    = registros;
  const gastosHastaHoy = registros.filter(r => r.fecha <= HOY_ISO);

  const hastaHoy = agregarGastos(gastosHastaHoy, registros.length, ANIO_ACTUAL);
  // OJO con la forma de `finDeMes`: se agrega sobre TODAS las facturas
  // cargadas, sin ningún recorte temporal. Sus campos agregados de todo el
  // período (`kpi`, `porSucursal`, `topProveedores`, `porMedioPago`) incluyen
  // facturas de meses futuros — NO son "este mes, completo". Sólo los campos
  // indexados por mes (`gastosPorMes`, `gastosPorMesSucursal`, `chartData`)
  // son seguros de leer per-month; los agregados de arriba únicamente tienen
  // sentido cuando no hay mes seleccionado (donde el front fuerza 'hastaHoy').
  const finDeMes = agregarGastos(gastosCrudo, registros.length, ANIO_ACTUAL);

  const registrosDiariosGastos = gastosCrudo
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
    kpi: hastaHoy.kpi,
    chartData: hastaHoy.chartData,
    gastosPorMes: hastaHoy.gastosPorMes,
    gastosPorMesSucursal: hastaHoy.gastosPorMesSucursal,
    porSucursal: hastaHoy.porSucursal,
    topProveedores: hastaHoy.topProveedores,
    porMedioPago: hastaHoy.porMedioPago,
    registrosDiariosGastos,
    facturasSinFecha,
    ultimosRegistros: registros.slice(-10).reverse(),
    finDeMes,
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
