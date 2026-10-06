/**
 * GET /api/distribuidora-data
 *
 * Gastos de la Distribuidora (compras para abastecerse), leídos de la pestaña
 * "Facturas" de su planilla de Google Sheets.
 *
 * IMPORTANTE — esta ruta NO devuelve ventas, y es deliberado: los pedidos de la
 * Distribuidora se cargan en ConectOca bajo el mismo business_id que Producción,
 * pero /api/produccion-data EXCLUYE esos ítems (ver esCategoriaDistribuidora)
 * porque son mercadería de Distribuidora, no producción propia. Como
 * Distribuidora vende a costo (sin margen), no hay ninguna "venta" propia que
 * valga la pena trackear — lo único relevante es su gasto, y ese ya queda
 * anotado en la planilla del local que compra (proveedor "Distribuidora Oca",
 * ver normalizeProveedorName en src/lib/data/parsers.ts). Traer las ventas acá
 * no sumaría nada nuevo.
 *
 * El gasto tampoco se suma a los de Producción ni al total consolidado del
 * dashboard (src/app/page.tsx, `computed`/`computedDateRange`): va como línea
 * propia, solo referencial — ya está contado en el gasto del local.
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
import { hoyISOChile } from '@/lib/date-utils';

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
  const auth = await requireAuth(req);
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
    const gastosFinDeMes = await withCacheSWR(cacheKey, () =>
      fetchGastosFacturas(config.id, 'todos', desde, hasta),
    );
    const HOY_ISO = hoyISOChile();
    const gastosHastaHoy = gastosFinDeMes.filter(r => r.fecha <= HOY_ISO);

    function agregar(gastosArr: typeof gastosFinDeMes) {
      const totalGastos = gastosArr.reduce((s, r) => s + r.monto, 0);
      const totalFacturas = gastosArr.length;

      const mesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
      for (const r of gastosArr) {
        if (!r.mes || !r.anio) continue;
        const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
        if (!mesMap[key]) mesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
        mesMap[key].monto += r.monto;
      }
      const gastosPorMes = Object.entries(mesMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

      const detalle = [...gastosArr]
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(r => ({ fecha: r.fecha, proveedor: r.proveedor, monto: r.monto }));

      return {
        kpi: { totalGastos, totalFacturas },
        gastosPorMes,
        topProveedores: topProveedores(gastosArr),
        detalle,
      };
    }

    const hastaHoy = agregar(gastosHastaHoy);
    // Sólo { kpi, gastosPorMes } — misma forma que el `finDeMes` de
    // /api/produccion-data. El front sólo lee finDeMes.kpi.totalGastos;
    // incluir `detalle` (una entrada por factura) y `topProveedores` acá
    // duplicaba el peso de la respuesta sin que nadie los consumiera.
    const finDeMesFull = agregar(gastosFinDeMes);
    const finDeMes = { kpi: finDeMesFull.kpi, gastosPorMes: finDeMesFull.gastosPorMes };

    return NextResponse.json({
      ok: true,
      kpi: hastaHoy.kpi,
      gastosPorMes: hastaHoy.gastosPorMes,
      topProveedores: hastaHoy.topProveedores,
      detalle: hastaHoy.detalle,
      mesDesde,
      mesHasta,
      finDeMes,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[distribuidora-data]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
