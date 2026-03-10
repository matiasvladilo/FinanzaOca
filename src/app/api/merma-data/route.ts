/**
 * GET /api/merma-data
 * Lee la pestaña "MERMA" y devuelve registros agrupados por tipo y mes.
 *
 * Columnas usadas:
 *   PRODUCTO → nombre del producto
 *   TIPO     → categoría (Verdura, Panadería, etc.)
 *   MONTO    → costo de la merma
 *   FECHA    → fecha del registro
 *   MES      → número de mes
 *
 * Local: fijo según el spreadsheet (OCA LA REINA en este caso)
 */

import { NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/google-sheets';

function parseMonto(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/\$|\./g, '').replace(',', '.').trim()) || 0;
}

function parseFecha(raw: string): { mes: number; anio: number } {
  if (!raw?.trim()) return { mes: 0, anio: 0 };
  const p = raw.trim().split('/');
  if (p.length !== 3) return { mes: 0, anio: 0 };
  const [a, b, c] = p.map(x => parseInt(x, 10));
  if (!c || c < 2000) return { mes: 0, anio: 0 };
  if (b >= 1 && b <= 12) return { mes: b, anio: c };
  if (a >= 1 && a <= 12) return { mes: a, anio: c };
  return { mes: 0, anio: 0 };
}

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET() {
  try {
    const tab  = SHEETS.tabs.merma;
    const rows = await readSheet(SHEETS.id, `${tab}!A1:E5000`);
    if (rows.length < 2) return NextResponse.json({ ok: true, kpi: null, chartData: [], porTipo: [] });

    const [headers, ...data] = rows;

    const idx = {
      producto: headers.indexOf('PRODUCTO'),
      tipo:     headers.indexOf('TIPO'),
      monto:    headers.indexOf('MONTO'),
      fecha:    headers.indexOf('FECHA'),
      mes:      headers.indexOf('MES'),
    };

    const registros = data
      .filter(r => r[idx.monto])
      .map((r, i) => {
        const { anio } = parseFecha(r[idx.fecha] ?? '');
        const mes = parseInt(r[idx.mes] ?? '0', 10) || parseFecha(r[idx.fecha] ?? '').mes;
        return {
          id:       i + 1,
          producto: r[idx.producto] ?? '',
          tipo:     r[idx.tipo]     ?? 'Sin tipo',
          monto:    parseMonto(r[idx.monto] ?? ''),
          fecha:    r[idx.fecha]    ?? '',
          mes,
          anio,
        };
      });

    // ── KPI ─────────────────────────────────────────────────────────────────
    const totalMerma = registros.reduce((s, r) => s + r.monto, 0);

    // ── Agrupado por mes (gráfico) ───────────────────────────────────────────
    const porMes: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of registros) {
      if (!r.mes) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      porMes[key].monto += r.monto;
    }

    const chartData = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ fecha: `${MESES[v.mes]} ${v.anio}`, monto: v.monto }));

    // ── Agrupado por tipo (donut/barras) ─────────────────────────────────────
    const tipoMap: Record<string, number> = {};
    for (const r of registros) {
      tipoMap[r.tipo] = (tipoMap[r.tipo] ?? 0) + r.monto;
    }

    const COLORES = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F97316', '#EF4444', '#D1D5DB'];
    const porTipo = Object.entries(tipoMap)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, monto], i) => ({
        nombre,
        monto,
        porcentaje: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
        color: COLORES[i % COLORES.length],
      }));

    // ── Últimos registros ────────────────────────────────────────────────────
    const ultimosRegistros = registros.slice(-10).reverse().map(r => ({
      id:       r.id,
      producto: r.producto,
      tipo:     r.tipo,
      monto:    r.monto,
      fecha:    r.fecha,
    }));

    return NextResponse.json({
      ok: true,
      kpi: {
        totalMerma,
        totalRegistros: registros.length,
        tipoMasFrecuente: porTipo[0]?.nombre ?? '—',
        montoMayor: porTipo[0]?.monto ?? 0,
      },
      chartData,
      porTipo,
      ultimosRegistros,
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
