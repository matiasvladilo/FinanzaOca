/**
 * GET /api/distribuidora-data
 *
 * Gastos de la Distribuidora (compras para abastecerse), leídos de la pestaña
 * "Facturas" de su planilla de Google Sheets.
 *
 * IMPORTANTE — esta ruta NO devuelve ventas, y es deliberado: los pedidos de la
 * Distribuidora se cargan en ConectOca bajo el mismo business_id que Producción,
 * así que sus ventas ya están contadas en /api/produccion-data. Traerlas acá
 * las duplicaría.
 *
 * Los gastos tampoco se suman a los de Producción: van como línea propia.
 *
 * Query params (modo mes):
 *   mesDesde  → "YYYY-MM"  (default: hace 2 meses)
 *   mesHasta  → "YYYY-MM"  (default: mes actual)
 * Query params (modo fecha, tienen prioridad):
 *   fechaDesde → "YYYY-MM-DD"
 *   fechaHasta → "YYYY-MM-DD"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDistribuidoraConfig } from '@/lib/google-sheets';
import { fetchGastosFacturas, topProveedores } from '@/lib/data/gastos';
import { getMesLabel } from '@/lib/data/parsers';
import { withCacheSWR } from '@/lib/data/cache';
import { requireAuth } from '@/lib/auth-api';

const CACHE_PREFIX = 'distribuidora-v1';

// ── Rango de fechas (misma lógica que /api/produccion-data) ──────────────────
function getDateRange(params: {
  mesDesde?: string; mesHasta?: string;
  fechaDesde?: string; fechaHasta?: string;
}) {
  if (params.fechaDesde && params.fechaHasta) {
    const [dy, dm, dd] = params.fechaDesde.split('-').map(Number);
    const [hy, hm, hd] = params.fechaHasta.split('-').map(Number);
    return {
      desde: new Date(Date.UTC(dy, dm - 1, dd, 0, 0, 0, 0)),
      hasta: new Date(Date.UTC(hy, hm - 1, hd, 23, 59, 59, 999)),
    };
  }
  const [dy, dm] = (params.mesDesde ?? '').split('-').map(Number);
  const [hy, hm] = (params.mesHasta ?? '').split('-').map(Number);
  return {
    desde: new Date(Date.UTC(dy, dm - 1, 1, 0, 0, 0, 0)),
    hasta: new Date(Date.UTC(hy, hm, 0, 23, 59, 59, 999)), // último ms del mes
  };
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const config = getDistribuidoraConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: 'SHEET_DISTRIBUIDORA_ID no está configurada' },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = req.nextUrl;

    const hoy = new Date();
    const defaultHasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    const defaultDesde = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;

    const mesDesde   = searchParams.get('mesDesde')   ?? defaultDesde;
    const mesHasta   = searchParams.get('mesHasta')   ?? defaultHasta;
    const fechaDesde = searchParams.get('fechaDesde') ?? '';
    const fechaHasta = searchParams.get('fechaHasta') ?? '';

    const { desde, hasta } = getDateRange({ mesDesde, mesHasta, fechaDesde, fechaHasta });

    const cacheKey = `${CACHE_PREFIX}:${desde.toISOString()}:${hasta.toISOString()}`;
    const gastos = await withCacheSWR(cacheKey, () =>
      fetchGastosFacturas(config.id, 'todos', desde, hasta),
    );

    // ── KPI ───────────────────────────────────────────────────────────────────
    const totalGastos = gastos.reduce((s, r) => s + r.monto, 0);
    const totalFacturas = gastos.length;

    // ── Gastos por mes ────────────────────────────────────────────────────────
    const mesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of gastos) {
      if (!r.mes || !r.anio) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!mesMap[key]) mesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      mesMap[key].monto += r.monto;
    }
    const gastosPorMes = Object.entries(mesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Detalle de facturas (más recientes primero) ──────────────────────────
    const detalle = [...gastos]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map(r => ({ fecha: r.fecha, proveedor: r.proveedor, monto: r.monto }));

    return NextResponse.json({
      ok: true,
      kpi: { totalGastos, totalFacturas },
      gastosPorMes,
      topProveedores: topProveedores(gastos),
      detalle,
      mesDesde,
      mesHasta,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[distribuidora-data]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
