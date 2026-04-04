/**
 * google-sheets.ts
 * Utilidad de servidor para leer datos de Google Sheets.
 * SOLO se usa en Server Components o Route Handlers (nunca en 'use client').
 */

import 'server-only';
import { google } from 'googleapis';

// ── Autenticación con Service Account ─────────────────────────────────────────
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ── Función genérica: leer un rango de cualquier planilla ─────────────────────
/**
 * Lee un rango de una planilla con reintentos automáticos.
 * Hasta 3 intentos con backoff exponencial (1s, 2s, 4s).
 */
export async function readSheet(
  sheetId: string,
  range: string,         // ej: 'Hoja1!A:F'  o  'Ventas!A2:D100'
  maxRetries = 3,
): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
      });
      return (response.data.values as string[][]) ?? [];
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ── Leer múltiples rangos de una misma planilla en una sola llamada ───────────
/**
 * Equivalente a readSheet pero para múltiples rangos en una sola llamada API.
 * Útil para evitar quota exceeded cuando se necesitan varias pestañas.
 *
 * Ejemplo:
 *   const [salidas, pagos, cc] = await readSheetBatch(id, ['SALIDAS!A1:G500', 'PAGOS!A1:D500', 'CUENTA_CORRIENTE!A1:H60'])
 */
export async function readSheetBatch(
  sheetId: string,
  ranges: string[],
  maxRetries = 3,
): Promise<string[][][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: sheetId,
        ranges,
      });
      const valueRanges = response.data.valueRanges ?? [];
      return ranges.map((_, i) => (valueRanges[i]?.values as string[][]) ?? []);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ── Función genérica: leer columnas específicas por nombre de encabezado ──────
/**
 * Lee una hoja y devuelve solo las columnas que pidas por nombre de encabezado.
 *
 * Ejemplo:
 *   const rows = await readColumns(SHEET_ID, 'Ventas', ['Fecha', 'Monto', 'Sucursal'])
 *   // → [{ Fecha: '2024-06-01', Monto: '450000', Sucursal: 'PV' }, ...]
 */
export async function readColumns(
  sheetId: string,
  sheetName: string,
  columns: string[]
): Promise<Record<string, string>[]> {
  const raw = await readSheet(sheetId, `${sheetName}!A1:ZZ`);
  if (!raw.length) return [];

  const headers = raw[0];
  const colIndexes = columns.map((col) => headers.indexOf(col));

  const missing = columns.filter((_, i) => colIndexes[i] === -1);
  if (missing.length) {
    console.warn(`[Sheets] Columnas no encontradas: ${missing.join(', ')}`);
  }

  return raw.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => {
      obj[col] = colIndexes[i] !== -1 ? (row[colIndexes[i]] ?? '') : '';
    });
    return obj;
  });
}

// ── Nombres de pestañas (iguales en los 4 locales) ───────────────────────────
export const TABS = {
  facturas:   'Facturas',
  cierreCaja: 'Cierre de Caja',
  merma:      'MERMA',
} as const;

// ── Configuración multi-local ─────────────────────────────────────────────────
// Cada local tiene su propio spreadsheet con las mismas pestañas.
// Los IDs vienen de variables de entorno server-side.
export interface LocalSheetConfig {
  nombre: string;   // nombre canónico del local
  id: string;       // spreadsheet ID
  tabs: typeof TABS;
}

export function getLocalesConfig(): LocalSheetConfig[] {
  return [
    { nombre: 'La Reina', id: process.env.SHEET_LA_REINA_ID ?? '', tabs: TABS },
    { nombre: 'PV',       id: process.env.SHEET_PV_ID       ?? '', tabs: TABS },
    { nombre: 'PT',       id: process.env.SHEET_PT_ID       ?? '', tabs: TABS },
    { nombre: 'Bilbao',   id: process.env.SHEET_BILBAO_ID   ?? '', tabs: TABS },
  ].filter(l => l.id); // excluir locales sin ID configurado
}

/** Planilla única de producción (Panadería + Pastelería en columna Local) */
export function getProduccionConfig(): LocalSheetConfig | null {
  const id = process.env.SHEET_PRODUCCION_ID ?? '';
  if (!id) return null;
  return { nombre: 'Produccion', id, tabs: TABS };
}

// ── Alias de compatibilidad (no romper código existente) ─────────────────────
export function getSheetsConfig() {
  return { id: process.env.SHEET_VENTAS_ID ?? '', tabs: TABS };
}

export const SHEETS = {
  get id() { return process.env.SHEET_VENTAS_ID ?? ''; },
  tabs: TABS,
};

export const SHEET_ID = process.env.SHEET_VENTAS_ID ?? '';
