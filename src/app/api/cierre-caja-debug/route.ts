/**
 * GET /api/cierre-caja-debug
 * Diagnóstico: muestra cuántas filas hay, cuántas por mes, y los primeros valores.
 * Eliminar esta ruta cuando ya no sea necesaria.
 */
import { NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/google-sheets';

function parseMonto(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/\$|\./g, '').replace(',', '.').trim()) || 0;
}

export async function GET() {
  try {
    const rows = await readSheet(SHEETS.id, `${SHEETS.tabs.cierreCaja}!A1:H5000`);
    const [headers, ...data] = rows;

    const idxFecha      = headers.indexOf('Fecha');
    const idxMes        = headers.indexOf('Mes');
    const idxTotalVenta = headers.indexOf('Total Venta');

    // Agrupa por mes
    const porMes: Record<string, { filas: number; total: number; ejemplos: string[] }> = {};
    for (const row of data) {
      if (!row[idxTotalVenta]) continue;
      const mes = row[idxMes] ?? '?';
      if (!porMes[mes]) porMes[mes] = { filas: 0, total: 0, ejemplos: [] };
      porMes[mes].filas++;
      porMes[mes].total += parseMonto(row[idxTotalVenta]);
      if (porMes[mes].ejemplos.length < 2) {
        porMes[mes].ejemplos.push(`${row[idxFecha]} → ${row[idxTotalVenta]}`);
      }
    }

    return NextResponse.json({
      ok: true,
      totalFilas: data.filter(r => r[idxTotalVenta]).length,
      porMes,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
