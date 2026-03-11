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
export async function readSheet(
  sheetId: string,
  range: string          // ej: 'Hoja1!A:F'  o  'Ventas!A2:D100'
): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  return (response.data.values as string[][]) ?? [];
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

// ── IDs de planillas y nombres de pestañas (centralizado) ────────────────────
export const SHEETS = {
  // Todas las hojas están en el mismo spreadsheet
  id: process.env.SHEET_VENTAS_ID ?? '',

  // Nombres de pestañas
  tabs: {
    facturas:    process.env.TAB_FACTURAS  ?? 'Facturas',
    cierreCaja:  process.env.TAB_VENTAS    ?? 'Cierre de Caja',
    merma:       process.env.TAB_MERMA     ?? 'MERMA',
  },
} as const;

// Alias para compatibilidad con código existente
export const SHEET_ID = process.env.SHEET_VENTAS_ID ?? '';
