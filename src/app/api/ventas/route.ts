/**
 * GET /api/ventas
 * Lee la hoja de Facturas (gastos) desde Google Sheets.
 * Columnas usadas:
 *   - Columna 1     → Sucursal (local)
 *   - Columna 3     → Tipo (GASTO/INGRESO) — por ahora todos son gastos
 *   - Columna 4     → Subtipo Documento (FACTURA, BOLETA, etc.)
 *   - Columna 5     → Proveedor/Cliente
 *   - Columna 7     → Medio de Pago (CHEQUE, TRANSFERENCIA, etc.)
 *   - Columna 8     → Total Factura → monto del gasto
 *   - Columna 9     → Fecha Emitida → fecha de cobro
 *
 * Nota: pasar el nombre real de la pestaña como ?tab=NombrePestaña
 * Por defecto usa la primera hoja.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, SHEETS } from '@/lib/google-sheets';

// Parsea "$30.770" o "30.770" o "30770" → 30770
function parseMonto(raw: string): number {
  if (!raw) return 0;
  // Elimina signo $, puntos de miles, espacios; reemplaza coma decimal por punto
  const clean = raw.replace(/\$|\s/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

// Normaliza el nombre de la sucursal a las 4 conocidas
function normalizaSucursal(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (s.includes('LA REINA'))                        return 'La Reina';
  if (s.includes('BILBAO'))                          return 'Bilbao';
  if (s.includes(' PT') || s.startsWith('PT') || s.includes('PUENTE')) return 'PT';
  if (s.includes(' PV') || s.startsWith('PV') || s.includes('PROVIDENCIA')) return 'PV';
  return raw.trim();
}

// Extrae mes y año de una fecha "D/M/YYYY" o "DD/MM/YYYY"
function parseFecha(raw: string): { mes: number; anio: number; iso: string } {
  if (!raw?.trim()) return { mes: 0, anio: 0, iso: '' };
  const p = raw.trim().split('/');
  if (p.length !== 3) return { mes: 0, anio: 0, iso: '' };
  const [a, b, c] = p.map(x => parseInt(x, 10));
  if (!c || c < 2000) return { mes: 0, anio: 0, iso: '' };
  // DD/MM/YYYY: si b es mes válido úsalo; si b > 12 intentar a como mes
  const mes  = (b >= 1 && b <= 12) ? b : (a >= 1 && a <= 12 ? a : 0);
  const dia  = (b >= 1 && b <= 12) ? a : b;
  if (!mes) return { mes: 0, anio: 0, iso: '' };
  return { mes, anio: c, iso: `${c}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}` };
}

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') ?? SHEETS.tabs.facturas;
    const range = `${tab}!A1:Z5000`;

    const rows = await readSheet(SHEETS.id, range);
    if (rows.length < 2) return NextResponse.json({ ok: true, registros: [], kpi: null, chartData: [] });

    const [headers, ...dataRows] = rows;

    // Índices dinámicos por nombre de encabezado
    const idx = {
      sucursal:  headers.indexOf('Columna 1'),
      tipo:      headers.indexOf('Tipo (Ingreso/Gasto)'),
      subtipo:   headers.indexOf('Subtipo Doc'),
      proveedor: headers.indexOf('Proveedor/Cliente'),
      medioPago: headers.indexOf('Medio de Pago'),
      monto:     headers.indexOf('Total Factura'),
      fecha:     headers.indexOf('FECHA EMITIDA'),
      mes:       headers.indexOf('Mes') !== -1 ? headers.indexOf('Mes') : headers.indexOf('MES'),
    };

    // Transforma filas — solo las que tienen monto
    const registros = dataRows
      .filter(row => row[idx.monto] && row[idx.sucursal])
      .map((row, i) => {
        const { anio, iso } = parseFecha(row[idx.fecha] ?? '');
        const mesCol = idx.mes >= 0 ? parseInt(row[idx.mes] ?? '0', 10) : 0;
        const mes = mesCol || parseFecha(row[idx.fecha] ?? '').mes;
        return {
          id:        i + 1,
          sucursal:  normalizaSucursal(row[idx.sucursal] ?? ''),
          tipo:      (row[idx.tipo] ?? 'GASTO').toUpperCase(),
          subtipo:   row[idx.subtipo]   ?? '',
          proveedor: row[idx.proveedor] ?? '',
          medioPago: row[idx.medioPago] ?? '',
          monto:     parseMonto(row[idx.monto] ?? ''),
          fecha:     iso,
          mes,
          anio,
        };
      });

    // ── KPI global ──────────────────────────────────────────────────────────
    const gastos  = registros.filter(r => r.tipo !== 'INGRESO');
    const ingresos = registros.filter(r => r.tipo === 'INGRESO');
    const totalGastos  = gastos.reduce((s, r)  => s + r.monto, 0);
    const totalIngresos = ingresos.reduce((s, r) => s + r.monto, 0);

    // ── Agrupado por mes (para el gráfico) ─────────────────────────────────
    const porMes: Record<string, { mes: number; anio: number; ventas: number; gastos: number }> = {};
    for (const r of registros) {
      if (!r.mes) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, ventas: 0, gastos: 0 };
      if (r.tipo === 'INGRESO') porMes[key].ventas += r.monto;
      else                      porMes[key].gastos += r.monto;
    }

    const chartData = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        fecha:  `${MESES[v.mes]} ${v.anio}`,
        ventas: v.ventas,
        gastos: v.gastos,
      }));

    // gastos keyed por "YYYY-MM" para filtrado cliente
    const gastosPorMes: Record<string, number> = {};
    for (const [key, v] of Object.entries(porMes)) {
      gastosPorMes[key] = v.gastos;
    }

    // ── Por sucursal ────────────────────────────────────────────────────────
    const porSucursal: Record<string, { ventas: number; gastos: number; transacciones: number }> = {};
    for (const r of registros) {
      if (!porSucursal[r.sucursal]) porSucursal[r.sucursal] = { ventas: 0, gastos: 0, transacciones: 0 };
      if (r.tipo === 'INGRESO') porSucursal[r.sucursal].ventas += r.monto;
      else                      porSucursal[r.sucursal].gastos += r.monto;
      porSucursal[r.sucursal].transacciones++;
    }

    // ── Por proveedor (top 5) ───────────────────────────────────────────────
    const porProveedor: Record<string, number> = {};
    for (const r of gastos) {
      porProveedor[r.proveedor] = (porProveedor[r.proveedor] ?? 0) + r.monto;
    }
    const topProveedores = Object.entries(porProveedor)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([nombre, monto]) => ({ nombre, monto }));

    // ── Por medio de pago ───────────────────────────────────────────────────
    const porMedioPago: Record<string, number> = {};
    for (const r of gastos) {
      porMedioPago[r.medioPago] = (porMedioPago[r.medioPago] ?? 0) + r.monto;
    }

    // ── Registros diarios de gastos (para filtrado día/semana) ──────────────
    const registrosDiariosGastos = gastos
      .filter(r => r.fecha)
      .map(r => ({ fecha: r.fecha, sucursal: r.sucursal, monto: r.monto }));

    return NextResponse.json({
      ok: true,
      kpi: {
        totalGastos,
        totalIngresos,
        margen: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0,
        totalTransacciones: registros.length,
      },
      chartData,
      gastosPorMes,
      porSucursal,
      topProveedores,
      porMedioPago,
      registrosDiariosGastos,
      ultimosRegistros: registros.slice(-10).reverse(),
    });

  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
