/**
 * GET /api/cierre-caja
 * Lee la pestaña "Cierre de Caja" y devuelve ventas por local, fecha y medio de pago.
 *
 * Columnas usadas:
 *   Local          → sucursal
 *   Fecha          → fecha del cierre
 *   Efectivo Final → monto en efectivo
 *   Tarjeta        → monto en tarjeta
 *   Transferencias → monto en transferencia
 *   Total Venta    → total (suma de los tres)
 */

import { NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/google-sheets';

function parseMonto(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/\$|\./g, '').replace(',', '.').trim()) || 0;
}

function normalizaLocal(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes('LA REINA'))  return 'La Reina';
  if (s.includes('BILBAO'))    return 'Bilbao';
  if (s.includes('PT') || s.includes('PUENTE')) return 'PT';
  if (s.includes('PV') || s.includes('PROVIDENCIA')) return 'PV';
  return raw.trim();
}

function parseFecha(raw: string): { mes: number; anio: number; iso: string } {
  if (!raw?.trim()) return { mes: 0, anio: 0, iso: '' };
  const p = raw.trim().split('/');
  if (p.length !== 3) return { mes: 0, anio: 0, iso: '' };
  const [a, b, c] = p.map(x => parseInt(x, 10));
  if (!c || c < 2000) return { mes: 0, anio: 0, iso: '' };
  // DD/MM/YYYY: si a > 12, el día es definitivamente a → mes es b
  // Si b > 12, algo está mal con el mes → intentar a como mes
  const mes = (b >= 1 && b <= 12) ? b : (a >= 1 && a <= 12 ? a : 0);
  const dia = (b >= 1 && b <= 12) ? a : b;
  if (!mes) return { mes: 0, anio: 0, iso: '' };
  const iso = `${c}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  return { mes, anio: c, iso };
}

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET() {
  try {
    const tab   = SHEETS.tabs.cierreCaja;
    const rows  = await readSheet(SHEETS.id, `${tab}!A1:H5000`);
    if (rows.length < 2) return NextResponse.json({ ok: true, kpi: null, chartData: [], porLocal: {} });

    const [headers, ...data] = rows;

    const idx = {
      local:      headers.indexOf('Local'),
      fecha:      headers.indexOf('Fecha'),
      mes:        headers.indexOf('Mes'),
      efectivo:   headers.indexOf('Efectivo Final'),
      tarjeta:    headers.indexOf('Tarjeta'),
      transf:     headers.indexOf('Transferencias'),
      totalVenta: headers.indexOf('Total Venta'),
    };

    const registros = data
      .filter(r => r[idx.totalVenta])
      .map((r, i) => {
        const { anio, iso } = parseFecha(r[idx.fecha] ?? '');
        const mes = parseInt(r[idx.mes] ?? '0', 10) || parseFecha(r[idx.fecha] ?? '').mes;
        return {
          id:         i + 1,
          local:      normalizaLocal(r[idx.local] ?? ''),
          fecha:      r[idx.fecha] ?? '',
          fechaISO:   iso,
          mes,
          anio,
          efectivo:   parseMonto(r[idx.efectivo]   ?? ''),
          tarjeta:    parseMonto(r[idx.tarjeta]    ?? ''),
          transf:     parseMonto(r[idx.transf]     ?? ''),
          totalVenta: parseMonto(r[idx.totalVenta] ?? ''),
        };
      });

    // ── KPI global ──────────────────────────────────────────────────────────
    const totalVentas   = registros.reduce((s, r) => s + r.totalVenta, 0);
    const totalEfectivo = registros.reduce((s, r) => s + r.efectivo,   0);
    const totalTarjeta  = registros.reduce((s, r) => s + r.tarjeta,    0);
    const totalTransf   = registros.reduce((s, r) => s + r.transf,     0);

    // ── Gráfico por mes ─────────────────────────────────────────────────────
    const porMes: Record<string, { mes: number; anio: number; ventas: number; efectivo: number; tarjeta: number; transf: number }> = {};
    for (const r of registros) {
      if (!r.mes) continue;
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
        fecha:    `${MESES[v.mes]} ${v.anio}`,
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

    // ── Por local × mes (para filtrado cliente) ──────────────────────────
    type MesSlice = { ventas: number; efectivo: number; tarjeta: number; transf: number };
    const porLocalMes: Record<string, Record<string, MesSlice>> = {};
    for (const r of registros) {
      if (!r.mes) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!porLocalMes[r.local]) porLocalMes[r.local] = {};
      if (!porLocalMes[r.local][key]) porLocalMes[r.local][key] = { ventas: 0, efectivo: 0, tarjeta: 0, transf: 0 };
      porLocalMes[r.local][key].ventas   += r.totalVenta;
      porLocalMes[r.local][key].efectivo += r.efectivo;
      porLocalMes[r.local][key].tarjeta  += r.tarjeta;
      porLocalMes[r.local][key].transf   += r.transf;
    }
    const mesesDisponibles = Object.keys(porMes).sort();

    // ── Desglose medio de pago (%) ──────────────────────────────────────────
    const medioPago = totalVentas > 0 ? {
      efectivo: Math.round((totalEfectivo / totalVentas) * 100),
      tarjeta:  Math.round((totalTarjeta  / totalVentas) * 100),
      transf:   Math.round((totalTransf   / totalVentas) * 100),
    } : { efectivo: 0, tarjeta: 0, transf: 0 };

    // ── Registros diarios (para filtrado día/semana) ─────────────────────────
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

    return NextResponse.json({
      ok: true,
      kpi: { totalVentas, totalEfectivo, totalTarjeta, totalTransf, totalCierres: registros.length },
      chartData,
      porLocal,
      porLocalMes,
      mesesDisponibles,
      medioPago,
      registrosDiarios,
      ultimosCierres: registros.slice(-5).reverse(),
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
