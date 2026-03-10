/**
 * GET /api/sheets-test?tab=NombrePestaña
 * Muestra encabezados + 2 filas de muestra de cualquier pestaña.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/google-sheets';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') ?? '';
    const range = tab ? `${tab}!A1:Z3` : 'A1:Z3';

    const rows = await readSheet(SHEETS.id, range);

    return NextResponse.json({
      ok: true,
      tab: tab || '(primera hoja)',
      headers:    rows[0] ?? [],
      sampleRow1: rows[1] ?? [],
      sampleRow2: rows[2] ?? [],
      totalColumnas: rows[0]?.length ?? 0,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
