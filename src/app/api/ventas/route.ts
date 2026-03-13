/**
 * GET /api/ventas
 * Lee "Facturas" (gastos/ingresos) de los 4 locales en paralelo y combina.
 *
 * Columnas usadas — varía por local, se hace matching case-insensitive:
 *   Tipo (Ingreso/Gasto), Subtipo Doc, Proveedor/Cliente,
 *   Medio de Pago, Total Factura / Columna 8 (PT), FECHA EMITIDA / Fecha emitida / Fecha
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';
import { parseMonto, parseFecha, getMesLabel, findHeader } from '@/lib/data/parsers';
import { withCache } from '@/lib/data/cache';

const CACHE_KEY = 'ventas-v5';

async function fetchLocalVentas(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:Z5000`);
  if (rows.length < 2) return [];

  const [headers, ...dataRows] = rows;
  const idx = {
    tipo:      findHeader(headers, 'Tipo (Ingreso/Gasto)'),
    subtipo:   findHeader(headers, 'Subtipo Doc'),
    proveedor: findHeader(headers, 'Proveedor/Cliente'),
    medioPago: findHeader(headers, 'Medio de Pago'),
    // PT usa "Monto"; La Reina/PV/Bilbao usan "Total Factura"
    monto:     findHeader(headers, 'Total Factura', 'Monto', 'Columna 8', 'Total'),
    // Fecha primaria (col B) — si vacía, usar FECHA EMITIDA como fallback
    fecha:     findHeader(headers, 'Fecha', 'FECHA'),
    fechaAlt:  findHeader(headers, 'FECHA EMITIDA', 'Fecha emitida'),
    mes:       findHeader(headers, 'Mes', 'MES', 'mes'),
  };

  return dataRows
    .filter(row => row[idx.monto])
    .map((row, i) => {
      // Usar "Fecha" principal; si el año es inválido caer a "FECHA EMITIDA"
      let fecha = parseFecha(row[idx.fecha] ?? '');
      if (fecha.anio < 2000 && idx.fechaAlt >= 0) {
        const alt = parseFecha(row[idx.fechaAlt] ?? '');
        if (alt.anio >= 2000) fecha = alt;
      }
      const mesCol  = idx.mes >= 0 ? parseInt(row[idx.mes] ?? '0', 10) : 0;
      const mes     = mesCol || fecha.mes;
      return {
        id:        i + 1,
        sucursal:  nombre,
        tipo:      (row[idx.tipo] ?? 'GASTO').toUpperCase(),
        subtipo:   row[idx.subtipo]   ?? '',
        proveedor: row[idx.proveedor] ?? '',
        medioPago: row[idx.medioPago] ?? '',
        monto:     parseMonto(row[idx.monto] ?? ''),
        fecha:     fecha.iso,
        mes,
        anio:      fecha.anio,
      };
    });
}

async function fetchVentas() {
  const locales = getLocalesConfig();

  const results = await Promise.allSettled(
    locales.map(l => fetchLocalVentas(l.nombre, l.id, l.tabs.facturas))
  );

  const registros = results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`[ventas] Error leyendo ${locales[i].nombre}:`, r.reason);
    return [];
  });

  if (registros.length === 0) return null;

  // Gastos = TODAS las filas de facturas (el sheet suma GASTO+INGRESO sin filtrar por tipo)
  const gastos   = registros; // todas las filas
  const ingresos = registros.filter(r => r.tipo === 'INGRESO');
  const totalGastos   = gastos.reduce((s, r) => s + r.monto, 0);
  const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);

  // ── Por mes ─────────────────────────────────────────────────────────────
  const porMes: Record<string, { mes: number; anio: number; ventas: number; gastos: number }> = {};
  for (const r of registros) {
    if (!r.mes || r.anio < 2000) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, gastos: 0 };
    porMes[key].gastos += r.monto; // suma todo (GASTO + INGRESO = total facturas)
  }

  const chartData = Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), ventas: v.ventas, gastos: v.gastos }));

  const gastosPorMes: Record<string, number> = {};
  for (const [key, v] of Object.entries(porMes)) gastosPorMes[key] = v.gastos;

  // ── Por sucursal ────────────────────────────────────────────────────────
  const porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }> = {};
  for (const r of registros) {
    if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, transacciones: 0 };
    porSucursal[r.sucursal].gastos += r.monto; // total facturas (GASTO+INGRESO)
    porSucursal[r.sucursal].transacciones++;
  }

  // ── Gastos por mes + sucursal (para filtrar gráfico por local) ───────────
  const gastosPorMesSucursal: Record<string, Record<string, number>> = {};
  for (const r of registros) {
    if (!r.mes || r.anio < 2000) continue;
    const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
    if (!gastosPorMesSucursal[r.sucursal]) gastosPorMesSucursal[r.sucursal] = {};
    gastosPorMesSucursal[r.sucursal][key] = (gastosPorMesSucursal[r.sucursal][key] ?? 0) + r.monto;
  }

  // ── Top proveedores ─────────────────────────────────────────────────────
  const porProveedor: Record<string, number> = {};
  for (const r of gastos) {
    porProveedor[r.proveedor] = (porProveedor[r.proveedor] ?? 0) + r.monto;
  }
  const topProveedores = Object.entries(porProveedor)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([nombre, monto]) => ({ nombre, monto }));

  // ── Por medio de pago ───────────────────────────────────────────────────
  const porMedioPago: Record<string, number> = {};
  for (const r of gastos) {
    porMedioPago[r.medioPago] = (porMedioPago[r.medioPago] ?? 0) + r.monto;
  }

  const registrosDiariosGastos = gastos
    .filter(r => r.fecha)
    .map(r => ({ fecha: r.fecha, sucursal: r.sucursal, monto: r.monto, proveedor: r.proveedor, subtipo: r.subtipo }));

  return {
    kpi: {
      totalGastos,
      totalIngresos,
      margen: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0,
      totalTransacciones: registros.length,
    },
    chartData,
    gastosPorMes,
    gastosPorMesSucursal,
    porSucursal,
    topProveedores,
    porMedioPago,
    registrosDiariosGastos,
    ultimosRegistros: registros.slice(-10).reverse(),
  };
}

export async function GET(req: NextRequest) {
  try {
    // Si viene un ?tab= personalizado, leer sin caché (caso especial)
    const { searchParams } = new URL(req.url);
    if (searchParams.get('tab')) {
      const data = await fetchVentas();
      if (!data) return NextResponse.json({ ok: true, registros: [], kpi: null, chartData: [] });
      return NextResponse.json({ ok: true, ...data });
    }

    const data = await withCache(CACHE_KEY, fetchVentas);
    if (!data) return NextResponse.json({ ok: true, registros: [], kpi: null, chartData: [] });
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
