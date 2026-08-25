import { NextRequest, NextResponse } from 'next/server';
import { readSheet } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/auth-api';

export interface PresupuestoRow {
  local: string;
  mes: number;
  año: number;
  presupuesto: number;
}

/**
 * Todo el presupuesto cargado (todos los locales, todos los meses). La
 * planilla es chica (una fila por local×mes), así que no hace falta filtrar
 * en el server — tanto el GET de acá como el asistente virtual filtran del
 * lado que corresponda sobre este mismo array.
 */
export async function fetchPresupuesto(): Promise<PresupuestoRow[]> {
  const sheetId = process.env.SHEET_PRESUPUESTO_ID;
  if (!sheetId) return [];

  const rows = await readSheet(sheetId, 'A:D');
  if (!rows.length) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const idxLocal = headers.findIndex(h => h === 'local');
  const idxMes   = headers.findIndex(h => h === 'mes');
  const idxAño   = headers.findIndex(h => h.startsWith('a') && h.includes('o')); // año / ano
  const idxPres  = headers.findIndex(h => h === 'presupuesto');

  return rows.slice(1)
    .filter(row => row.some(c => c?.trim()))
    .map(row => ({
      local:       (row[idxLocal] ?? '').trim(),
      mes:         parseInt(row[idxMes] ?? '0', 10),
      año:         parseInt(row[idxAño] ?? '0', 10),
      presupuesto: parseFloat((row[idxPres] ?? '0').replace(/[.$\s]/g, '').replace(',', '.')) || 0,
    }))
    .filter(r => r.local && r.mes > 0 && r.año > 0);
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!process.env.SHEET_PRESUPUESTO_ID) {
    return NextResponse.json({ ok: false, error: 'SHEET_PRESUPUESTO_ID no configurado' }, { status: 500 });
  }

  try {
    const data = await fetchPresupuesto();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[presupuesto]', err);
    return NextResponse.json({ ok: false, error: 'Error leyendo presupuesto' }, { status: 500 });
  }
}
