import { NextRequest, NextResponse } from 'next/server';
import { readSheet } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/auth-api';

export interface PresupuestoRow {
  local: string;
  mes: number;
  año: number;
  presupuesto: number;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const sheetId = process.env.SHEET_PRESUPUESTO_ID;
  if (!sheetId) {
    return NextResponse.json({ ok: false, error: 'SHEET_PRESUPUESTO_ID no configurado' }, { status: 500 });
  }

  try {
    const rows = await readSheet(sheetId, 'A:D');
    if (!rows.length) return NextResponse.json({ ok: true, data: [] });

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idxLocal = headers.findIndex(h => h === 'local');
    const idxMes   = headers.findIndex(h => h === 'mes');
    const idxAño   = headers.findIndex(h => h.startsWith('a') && h.includes('o')); // año / ano
    const idxPres  = headers.findIndex(h => h === 'presupuesto');

    const data: PresupuestoRow[] = rows.slice(1)
      .filter(row => row.some(c => c?.trim()))
      .map(row => ({
        local:       (row[idxLocal] ?? '').trim(),
        mes:         parseInt(row[idxMes] ?? '0', 10),
        año:         parseInt(row[idxAño] ?? '0', 10),
        presupuesto: parseFloat((row[idxPres] ?? '0').replace(/[.$\s]/g, '').replace(',', '.')) || 0,
      }))
      .filter(r => r.local && r.mes > 0 && r.año > 0);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[presupuesto]', err);
    return NextResponse.json({ ok: false, error: 'Error leyendo presupuesto' }, { status: 500 });
  }
}
