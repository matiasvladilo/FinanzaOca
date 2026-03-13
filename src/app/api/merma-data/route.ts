/**
 * GET /api/merma-data
 * Lee "MERMA" de los 4 locales en paralelo y combina los registros.
 *
 * Columnas usadas: PRODUCTO, TIPO, MONTO, FECHA, MES
 *
 * Query params:
 *   local      → filtrar por local canónico ("PV", "La Reina", "PT", "Bilbao")
 *   periodo    → "7d" | "14d" | "mes" | "mes_anterior" | "anio"
 *   fechaDesde → YYYY-MM-DD
 *   fechaHasta → YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';
import { parseMonto, parseFecha, getMesLabel, getPeriodoRange, findHeader } from '@/lib/data/parsers';

const COLORES_MERMA = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F97316', '#EF4444', '#D1D5DB'];

async function fetchLocalMerma(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:G5000`);
  if (rows.length < 2) return [];

  const [headers, ...data] = rows;
  const idx = {
    // PT tiene "Columna 1" donde debería estar PRODUCTO — no hay nombre de producto en PT
    producto: findHeader(headers, 'PRODUCTO', 'Producto', 'producto'),
    // Todos tienen "TIPO " con espacio extra o "TIPO" sin espacio
    tipo:     findHeader(headers, 'TIPO', 'tipo', 'Tipo'),
    monto:    findHeader(headers, 'MONTO', 'monto', 'Monto'),
    fecha:    findHeader(headers, 'FECHA', 'Fecha', 'fecha'),
    mes:      findHeader(headers, 'MES', 'Mes', 'mes'),
  };

  return data
    .filter(r => r[idx.monto])
    .map((r, i) => {
      const fechaParsed = parseFecha(r[idx.fecha] ?? '');
      const mes = parseInt(r[idx.mes] ?? '0', 10) || fechaParsed.mes;
      return {
        id:       i + 1,
        producto: r[idx.producto] ?? '',
        tipo:     r[idx.tipo]     ?? 'Sin tipo',
        monto:    parseMonto(r[idx.monto] ?? ''),
        fecha:    r[idx.fecha]    ?? '',
        mes,
        anio:     fechaParsed.anio,
        date:     fechaParsed.date,
        local:    nombre,   // nombre canónico forzado por sheet
      };
    });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const localParam      = searchParams.get('local')      ?? 'todos';
    const periodoParam    = searchParams.get('periodo')     ?? '';
    const fechaDesdeParam = searchParams.get('fechaDesde')  ?? '';
    const fechaHastaParam = searchParams.get('fechaHasta')  ?? '';

    const locales = getLocalesConfig();

    // Si se filtra por local específico, solo leer ese sheet
    const localesALeer = (localParam && localParam !== 'todos' && localParam !== 'Todos')
      ? locales.filter(l => l.nombre.toLowerCase() === localParam.toLowerCase())
      : locales;

    const results = await Promise.allSettled(
      localesALeer.map(l => fetchLocalMerma(l.nombre, l.id, l.tabs.merma))
    );

    let registros = results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.error(`[merma-data] Error leyendo ${localesALeer[i].nombre}:`, r.reason);
      return [];
    });

    // ── Rango de fechas ──────────────────────────────────────────────────────
    let desde: Date | null = null;
    let hasta: Date | null = null;
    if (fechaDesdeParam) { desde = new Date(fechaDesdeParam); desde.setHours(0, 0, 0, 0); }
    if (fechaHastaParam) { hasta = new Date(fechaHastaParam); hasta.setHours(23, 59, 59, 999); }
    if (periodoParam && !fechaDesdeParam && !fechaHastaParam) {
      const range = getPeriodoRange(periodoParam);
      desde = range.desde;
      hasta = range.hasta;
    }

    // Filtrar por fecha
    if (desde || hasta) {
      registros = registros.filter(r => {
        if (desde && r.date && r.date < desde) return false;
        if (hasta && r.date && r.date > hasta) return false;
        return true;
      });
    }

    // ── Locales disponibles ──────────────────────────────────────────────────
    const localesDisponibles = ['Todos', ...locales.map(l => l.nombre)];

    // ── KPI ──────────────────────────────────────────────────────────────────
    const totalMerma = registros.reduce((s, r) => s + r.monto, 0);

    // ── Agrupado por mes ─────────────────────────────────────────────────────
    const porMes: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of registros) {
      if (!r.mes) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      porMes[key].monto += r.monto;
    }
    const chartData = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Agrupado por tipo ────────────────────────────────────────────────────
    const tipoMap: Record<string, number> = {};
    for (const r of registros) tipoMap[r.tipo] = (tipoMap[r.tipo] ?? 0) + r.monto;
    const porTipo = Object.entries(tipoMap)
      .sort(([, a], [, b]) => b - a)
      .map(([nombre, monto], i) => ({
        nombre, monto,
        porcentaje: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
        color: COLORES_MERMA[i % COLORES_MERMA.length],
      }));

    // ── Últimos registros ────────────────────────────────────────────────────
    const ultimosRegistros = [...registros].reverse().slice(0, 20).map(r => ({
      id: r.id, producto: r.producto, tipo: r.tipo,
      monto: r.monto, fecha: r.fecha, local: r.local,
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
      locales: localesDisponibles,
      filtros: { local: localParam, periodo: periodoParam },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
