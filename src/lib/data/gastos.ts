/**
 * gastos.ts
 * Parseo de la pestaña "Facturas" para las planillas que siguen el formato
 * de Producción (Local / Fecha / Gasto / Documento / … / Fecha vencimiento).
 *
 * Lo usan la planilla de Producción y la de Distribuidora, que son clones del
 * mismo template. Los 4 locales tienen otro formato y se parsean en /api/ventas.
 *
 * Fecha: se imputa el gasto por la columna I (fecha de vencimiento), porque el
 * negocio se mide por caja — el gasto ocurre cuando se cobra, no cuando se
 * recibe la mercadería. En estas planillas esa columna se llama
 * "Fecha vencimiento"; en las de los locales, "FECHA EMITIDA" (mismo dato,
 * rótulo distinto).
 *
 * SOLO usar en server-side (route handlers, server components).
 */

import { readSheet } from '@/lib/google-sheets';
import { parseMonto, parseFecha, findHeader, normalizeProveedorName } from '@/lib/data/parsers';

export interface GastoFactura {
  local: string;
  fecha: string;          // ISO "YYYY-MM-DD"
  monto: number;
  mes: number;
  anio: number;
  date: Date | null;
  proveedor: string;
}

/**
 * Lee y parsea la pestaña "Facturas" de una planilla con formato Producción.
 *
 * @param sheetId  ID del spreadsheet
 * @param local    "todos" para no filtrar, o el nombre exacto de la columna Local
 * @param desde    inicio del rango (inclusive)
 * @param hasta    fin del rango (inclusive)
 */
export async function fetchGastosFacturas(
  sheetId: string,
  local: string,
  desde: Date,
  hasta: Date,
): Promise<GastoFactura[]> {
  // Leer hasta columna Z (igual que los otros locales) para no cortar columnas
  const allRows = await readSheet(sheetId, 'Facturas!A1:Z5000');
  if (allRows.length < 2) return [];

  // Buscar la fila de headers dinámicamente (la planilla puede tener filas de título al inicio)
  const knownHeaders = ['local', 'fecha', 'proveedor', 'gasto', 'tipo', 'monto', 'total'];
  const headerIdx = allRows.findIndex(r =>
    r.some(c => knownHeaders.includes((c ?? '').toLowerCase().trim()))
  );
  if (headerIdx === -1 || headerIdx >= allRows.length - 1) return [];
  const headers = allRows[headerIdx];
  const data = allRows.slice(headerIdx + 1);

  // Misma lógica de fecha que los otros locales: FECHA EMITIDA primero, fallback a Fecha
  const idxFechaEmitida = findHeader(
    headers,
    'FECHA EMITIDA', 'Fecha emitida', 'Fecha Emitida', 'fecha emitida',
    'FECHA_EMITIDA', 'FechaEmitida', 'Fecha de emisión', 'Fecha de Emisión',
    'FECHA DE EMISION', 'Fecha Emision', 'Emision', 'Emisión',
  );
  const idxFechaFallback = findHeader(
    headers,
    'Fecha vencimiento', 'Fecha Vencimiento', 'FECHA VENCIMIENTO',
    'Fecha', 'FECHA', 'fecha',
  );

  const idx = {
    local:     findHeader(headers, 'Local', 'LOCAL', 'local'),
    monto:     findHeader(headers, 'Total factura', 'Total Factura', 'Total', 'Monto', 'MONTO', 'monto'),
    mes:       findHeader(headers, 'Mes', 'MES', 'mes'),
    // 'Columna 5' es el nombre autogenerado por Sheets en las planillas de
    // Producción y Distribuidora, donde la columna del proveedor nunca recibió
    // título. Va último: si algún día se la renombra, el nombre real gana.
    proveedor: findHeader(headers, 'Proveedor', 'Proveedor/Cliente', 'Proveedores', 'proveedor', 'Columna 5'),
  };

  const filterLocal = local && local !== 'todos' && local !== 'Todos' ? local.toLowerCase() : null;

  const result: GastoFactura[] = [];
  for (const r of data) {
    if (!r[idx.monto]) continue;

    // Misma lógica de fecha que ventas: FECHA EMITIDA → fallback Fecha
    let fp;
    if (idxFechaEmitida >= 0) {
      fp = parseFecha(r[idxFechaEmitida] ?? '');
    } else {
      fp = idxFechaFallback >= 0 ? parseFecha(r[idxFechaFallback] ?? '') : { anio: 0, mes: 0, dia: 0, iso: '', date: null };
    }

    // Descartar filas sin fecha válida (igual que ventas)
    if (fp.anio < 2020) continue;
    if (!fp.date || fp.date < desde || fp.date > hasta) continue;

    const localVal = r[idx.local] ?? '';
    if (filterLocal && localVal.toLowerCase() !== filterLocal) continue;

    result.push({
      local:     localVal,
      fecha:     fp.iso,
      monto:     parseMonto(r[idx.monto] ?? ''),
      mes:       fp.mes || parseInt(r[idx.mes] ?? '0', 10),
      anio:      fp.anio,
      date:      fp.date,
      proveedor: r[idx.proveedor] ?? '',
    });
  }
  return result;
}

/**
 * Agrupa gastos por proveedor y devuelve el top N por monto.
 * Antes de agrupar, las variantes tipeadas a mano del mismo proveedor se
 * unifican con normalizeProveedorName ("panaderia" y "panaderia y pasteleria"
 * son el mismo). El resto se agrupa por minúsculas y se muestra con la grafía
 * de la primera aparición.
 */
export function topProveedores(
  gastos: GastoFactura[],
  limite = 8,
): { nombre: string; monto: number }[] {
  const montos: Record<string, number> = {};
  const nombres: Record<string, string> = {};
  for (const r of gastos) {
    if (!r.proveedor) continue;
    const canonico = normalizeProveedorName(r.proveedor);
    const key = canonico.toLowerCase().trim();
    if (!key) continue;
    if (!nombres[key]) nombres[key] = canonico;
    montos[key] = (montos[key] ?? 0) + r.monto;
  }
  return Object.entries(montos)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limite)
    .map(([key, monto]) => ({ nombre: nombres[key], monto }));
}
