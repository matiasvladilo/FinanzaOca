/**
 * GET /api/cierre-caja
 * Lee "Cierre de Caja" de los 4 locales en paralelo y combina los datos.
 *
 * Columnas usadas (mismas en los 4 sheets):
 *   Local, Fecha, Mes, Efectivo Final, Tarjeta, Transferencias, Total Venta
 */

import { NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';
import { parseMonto, parseFecha, getMesLabel, findHeader } from '@/lib/data/parsers';
import { withCache } from '@/lib/data/cache';

const CACHE_KEY = 'cierre-caja';

async function fetchLocalCierreCaja(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:J5000`);
  if (rows.length < 2) return [];

  const [headers, ...data] = rows;
  const idx = {
    fecha:      findHeader(headers, 'Fecha', 'FECHA', 'fecha'),
    mes:        findHeader(headers, 'Mes', 'MES', 'mes'),
    efectivo:   findHeader(headers, 'Efectivo Final', 'Efectivo', 'EFECTIVO', 'Efectivo final', 'Caja Efectivo'),
    tarjeta:    findHeader(headers, 'Tarjeta', 'Tarjetas', 'TARJETA', 'Débito', 'Debito', 'Caja Tarjeta'),
    transf:     findHeader(headers, 'Transferencias', 'Transferencia', 'TRANSFERENCIAS', 'Transf', 'Caja Transferencia'),
    totalVenta: findHeader(headers, 'Total Venta', 'Total Ventas', 'TOTAL VENTA', 'TOTAL VENTAS', 'Total', 'Venta Total', 'Ventas Total', 'Venta'),
  };

  // Warn in dev when a critical header isn't found
  if (idx.totalVenta === -1) {
    console.warn(`[cierre-caja] "${nombre}": columna Total Venta no encontrada. Headers: ${headers.join(', ')}`);
  }

  return data
    .filter(r => {
      // Si tenemos columna de totalVenta, filtrar por ella; si no, exigir al menos fecha
      if (idx.totalVenta !== -1) return r[idx.totalVenta];
      return r[idx.fecha] ?? r[0]; // fila no vacía
    })
    .map((r, i) => {
      const fecha    = parseFecha(r[idx.fecha] ?? '');
      const mes      = parseInt(r[idx.mes] ?? '0', 10) || fecha.mes;
      const efectivo = parseMonto(r[idx.efectivo] ?? '');
      const tarjeta  = parseMonto(r[idx.tarjeta]  ?? '');
      const transf   = parseMonto(r[idx.transf]   ?? '');
      // Fallback: si no hay columna Total Venta, sumar los medios de pago
      const totalVenta = idx.totalVenta !== -1
        ? parseMonto(r[idx.totalVenta] ?? '')
        : efectivo + tarjeta + transf;
      return {
        id:   i + 1,
        local: nombre,
        fecha:     r[idx.fecha] ?? '',
        fechaISO:  fecha.iso,
        mes,
        anio:      fecha.anio,
        efectivo,
        tarjeta,
        transf,
        totalVenta,
      };
    })
    .filter(r => r.totalVenta > 0); // descartar filas vacías
}

async function fetchCierreCaja() {
  const locales = getLocalesConfig();

  // Leer los 4 sheets en paralelo
  const results = await Promise.allSettled(
    locales.map(l => fetchLocalCierreCaja(l.nombre, l.id, l.tabs.cierreCaja))
  );

  // Combinar registros de todos los locales (ignorar los que fallaron)
  const registros = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`[cierre-caja] Error leyendo ${locales[i].nombre}:`, r.reason);
    return [];
  });

  if (registros.length === 0) return null;

  // ── KPI global ──────────────────────────────────────────────────────────
  const totalVentas   = registros.reduce((s, r) => s + r.totalVenta, 0);
  const totalEfectivo = registros.reduce((s, r) => s + r.efectivo,   0);
  const totalTarjeta  = registros.reduce((s, r) => s + r.tarjeta,    0);
  const totalTransf   = registros.reduce((s, r) => s + r.transf,     0);

  // ── Gráfico por mes ─────────────────────────────────────────────────────
  const porMes: Record<string, { mes: number; anio: number; ventas: number; efectivo: number; tarjeta: number; transf: number }> = {};
  for (const r of registros) {
    if (!r.mes || r.anio < 2000) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, efectivo: 0, tarjeta: 0, transf: 0 };
    porMes[key].ventas   += r.totalVenta;
    porMes[key].efectivo += r.efectivo;
    porMes[key].tarjeta  += r.tarjeta;
    porMes[key].transf   += r.transf;
  }

  const chartData = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      fecha:    getMesLabel(v.mes, v.anio),
      ventas:   v.ventas,
      efectivo: v.efectivo,
      tarjeta:  v.tarjeta,
      transf:   v.transf,
    }));

  // ── Por local ───────────────────────────────────────────────────────────
  const porLocal: Record<string, { ventas: number; efectivo: number; tarjeta: number; transf: number; cierres: number }> = {};
  for (const r of registros) {
    if (!porLocal[r.local]) porLocal[r.local] = { ventas: 0, efectivo: 0, tarjeta: 0, transf: 0, cierres: 0 };
    porLocal[r.local].ventas   += r.totalVenta;
    porLocal[r.local].efectivo += r.efectivo;
    porLocal[r.local].tarjeta  += r.tarjeta;
    porLocal[r.local].transf   += r.transf;
    porLocal[r.local].cierres++;
  }

  // ── Por local × mes ──────────────────────────────────────────────────
  type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
  const porLocalMes: Record<string, Record<string, MesSlice>> = {};
  for (const r of registros) {
    if (!r.mes || r.anio < 2000) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porLocalMes[r.local]) porLocalMes[r.local] = {};
    if (!porLocalMes[r.local][key]) porLocalMes[r.local][key] = { ventas: 0, efectivo: 0, tarjeta: 0, transf: 0 };
    porLocalMes[r.local][key].ventas   += r.totalVenta;
    porLocalMes[r.local][key].efectivo += r.efectivo;
    porLocalMes[r.local][key].tarjeta  += r.tarjeta;
    porLocalMes[r.local][key].transf   += r.transf;
  }

  const mesesDisponibles = Object.keys(porMes).sort();

  // ── Medio de pago (%) ──────────────────────────────────────────────────
  const medioPago = totalVentas > 0 ? {
    efectivo: Math.round((totalEfectivo / totalVentas) * 100),
    tarjeta:  Math.round((totalTarjeta  / totalVentas) * 100),
    transf:   Math.round((totalTransf   / totalVentas) * 100),
  } : { efectivo: 0, tarjeta: 0, transf: 0 };

  // ── Registros diarios ─────────────────────────────────────────────────
  const registrosDiarios = registros
    .filter(r => r.fechaISO)
    .map(r => ({
      fecha:    r.fechaISO,
      local:    r.local,
      ventas:   r.totalVenta,
      efectivo: r.efectivo,
      tarjeta:  r.tarjeta,
      transf:   r.transf,
    }));

  return {
    kpi: { totalVentas, totalEfectivo, totalTarjeta, totalTransf, totalCierres: registros.length },
    chartData,
    porLocal,
    porLocalMes,
    mesesDisponibles,
    medioPago,
    registrosDiarios,
    ultimosCierres: registros.slice(-5).reverse(),
  };
}

export async function GET() {
  try {
    const data = await withCache(CACHE_KEY, fetchCierreCaja);
    if (!data) {
      return NextResponse.json({
        ok: true,
        kpi: null, chartData: [], porLocal: {}, porLocalMes: {},
        mesesDisponibles: [], medioPago: { efectivo: 0, tarjeta: 0, transf: 0 },
        registrosDiarios: [],
      });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
