/**
 * GET /api/supabase-analytics
 *
 * Extrae datos analíticos de ConectOca (Supabase) con caching agresivo
 * para minimizar llamadas a la base de datos.
 *
 * TTL: 30 minutos — los datos de pedidos/productos cambian menos
 * frecuentemente que los cierres de caja.
 *
 * Schema real (ConectOca — conectocadev):
 *   orders           → pedidos (created_at, total, status)
 *   order_items      → ítems   (product_name, quantity, price, production_area_id, created_at)
 *   production_areas → mapeo id→nombre usado como categoría
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { withCache } from '@/lib/data/cache';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// ─── SCHEMA — nombres reales de ConectOca ────────────────────────────────
const SCHEMA = {
  orders: {
    table:  'orders',
    fecha:  'created_at',
    total:  'total',
    estado: 'status',
  },
  items: {
    table:          'order_items',
    pedidoId:       'order_id',
    productoNombre: 'product_name',
    cantidad:       'quantity',
    precioUnitario: 'price',
    areaId:         'production_area_id', // proxy de categoría
    fecha:          'created_at',
  },
  areas: {
    table:  'production_areas',
    id:     'id',
    nombre: 'name',
  },
} as const;

// ─── Rango de consulta ────────────────────────────────────────────────────
function resolveRango(params: {
  meses?: number;
  mesDesde?: string; mesHasta?: string;
  fechaDesde?: string; fechaHasta?: string;
}): { desde: string; hasta: string } {
  // 1) Fechas exactas (YYYY-MM-DD)
  if (params.fechaDesde && params.fechaHasta) {
    return { desde: params.fechaDesde, hasta: params.fechaHasta };
  }
  // 2) Rango por mes (YYYY-MM)
  if (params.mesDesde && params.mesHasta) {
    const [dy, dm] = params.mesDesde.split('-').map(Number);
    const [hy, hm] = params.mesHasta.split('-').map(Number);
    const desde = new Date(dy, dm - 1, 1);
    const hasta = new Date(hy, hm, 0); // último día del mes hasta
    return {
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
    };
  }
  // 3) Fallback: N meses hacia atrás
  const meses = params.meses ?? 12;
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  d.setDate(1);
  const f = new Date();
  f.setDate(f.getDate() + 1);
  return { desde: d.toISOString().slice(0, 10), hasta: f.toISOString().slice(0, 10) };
}

// ─── Fetch principal ──────────────────────────────────────────────────────
async function fetchSupabaseAnalytics(fechaDesde: string, fechaHasta: string) {
  const db = getSupabaseClient();

  // Tres queries en paralelo — solo columnas necesarias, rango acotado
  const [ordersRes, itemsRes, areasRes] = await Promise.all([
    db
      .from(SCHEMA.orders.table)
      .select([
        SCHEMA.orders.fecha,
        SCHEMA.orders.total,
        SCHEMA.orders.estado,
      ].join(', '))
      .gte(SCHEMA.orders.fecha, fechaDesde)
      .lte(SCHEMA.orders.fecha, fechaHasta)
      .order(SCHEMA.orders.fecha, { ascending: true }),

    db
      .from(SCHEMA.items.table)
      .select([
        SCHEMA.items.productoNombre,
        SCHEMA.items.cantidad,
        SCHEMA.items.precioUnitario,
        SCHEMA.items.areaId,
        SCHEMA.items.fecha,
      ].join(', '))
      .gte(SCHEMA.items.fecha, fechaDesde)
      .lte(SCHEMA.items.fecha, fechaHasta),

    // production_areas es una tabla pequeña (sin filtro de fecha)
    db
      .from(SCHEMA.areas.table)
      .select([SCHEMA.areas.id, SCHEMA.areas.nombre].join(', ')),
  ]);

  if (ordersRes.error) throw new Error(`[orders] ${ordersRes.error.message}`);
  if (itemsRes.error)  throw new Error(`[items]  ${itemsRes.error.message}`);
  if (areasRes.error)  throw new Error(`[areas]  ${areasRes.error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: Record<string, unknown>[] = (ordersRes.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items:  Record<string, unknown>[] = (itemsRes.data  ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areas:  Record<string, unknown>[] = (areasRes.data  ?? []) as any[];

  // ── Mapeo id → nombre de área de producción ─────────────────────────────
  const areaMap: Record<string, string> = {};
  for (const area of areas) {
    const id     = String(area[SCHEMA.areas.id]     ?? '');
    const nombre = String(area[SCHEMA.areas.nombre] ?? 'Sin área');
    if (id) areaMap[id] = nombre;
  }

  // ── Agregación: pedidos por mes ─────────────────────────────────────────
  const porMesMap: Record<string, { ventas: number; pedidos: number }> = {};
  for (const o of orders) {
    const fechaStr = String(o[SCHEMA.orders.fecha] ?? '');
    const mes = fechaStr.slice(0, 7); // 'YYYY-MM'
    if (!mes || mes.length !== 7) continue;
    if (!porMesMap[mes]) porMesMap[mes] = { ventas: 0, pedidos: 0 };
    porMesMap[mes].ventas  += Number(o[SCHEMA.orders.total] ?? 0);
    porMesMap[mes].pedidos += 1;
  }
  const porMes = Object.entries(porMesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => ({ mes, ...v }));

  // ── Agregación: top productos ───────────────────────────────────────────
  const porProductoMap: Record<string, {
    nombre: string; categoria: string; unidades: number; ingresos: number;
    porSucursal: Record<string, number>;
  }> = {};
  for (const item of items) {
    const nombre = String(item[SCHEMA.items.productoNombre] ?? '(sin nombre)');
    const cant   = Number(item[SCHEMA.items.cantidad]       ?? 0);
    const precio = Number(item[SCHEMA.items.precioUnitario] ?? 0);
    const areaId = String(item[SCHEMA.items.areaId]         ?? '');
    const cat    = areaMap[areaId] ?? 'Sin área';
    if (!porProductoMap[nombre]) {
      porProductoMap[nombre] = { nombre, categoria: cat, unidades: 0, ingresos: 0, porSucursal: {} };
    }
    porProductoMap[nombre].unidades += cant;
    porProductoMap[nombre].ingresos += cant * precio;
  }
  const topProductos = Object.values(porProductoMap)
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 20);

  // ── Agregación: ventas por área de producción (proxy de categoría) ──────
  const porCategoriaMap: Record<string, { unidades: number; ingresos: number }> = {};
  for (const item of items) {
    const areaId = String(item[SCHEMA.items.areaId] ?? '');
    const cat    = areaMap[areaId] ?? 'Sin área';
    const cant   = Number(item[SCHEMA.items.cantidad]       ?? 0);
    const precio = Number(item[SCHEMA.items.precioUnitario] ?? 0);
    if (!porCategoriaMap[cat]) porCategoriaMap[cat] = { unidades: 0, ingresos: 0 };
    porCategoriaMap[cat].unidades += cant;
    porCategoriaMap[cat].ingresos += cant * precio;
  }
  const porCategoria = Object.entries(porCategoriaMap)
    .sort(([, a], [, b]) => b.ingresos - a.ingresos)
    .map(([categoria, v]) => ({ categoria, ...v }));

  // ── KPIs globales ────────────────────────────────────────────────────────
  const totalVentas   = orders.reduce((s, o) => s + Number(o[SCHEMA.orders.total] ?? 0), 0);
  const totalPedidos  = orders.length;
  const totalUnidades = Object.values(porProductoMap).reduce((s, p) => s + p.unidades, 0);
  const topCategoria  = porCategoria[0]?.categoria ?? null;
  const topProducto   = topProductos[0]?.nombre    ?? null;

  return {
    kpi: { totalVentas, totalPedidos, totalUnidades, topCategoria, topProducto },
    porMes,
    porSucursal: {}, // ConectOca no tiene columna de sucursal en orders
    topProductos,
    porCategoria,
    areas: Object.values(areaMap), // nombres de áreas disponibles
    fechaDesde,
    fechaHasta,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Route handler ────────────────────────────────────────────────────────
export async function GET(request: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: 'Supabase no configurado — agregar SUPABASE_URL y SUPABASE_ANON_KEY en .env.local',
    });
  }

  const { searchParams } = new URL(request.url);
  const mesesParam = parseInt(searchParams.get('meses') ?? '12', 10);
  const meses = isNaN(mesesParam) || mesesParam < 1 ? 12 : Math.min(mesesParam, 24);

  const { desde, hasta } = resolveRango({
    meses,
    mesDesde:   searchParams.get('mesDesde')   ?? undefined,
    mesHasta:   searchParams.get('mesHasta')   ?? undefined,
    fechaDesde: searchParams.get('fechaDesde') ?? undefined,
    fechaHasta: searchParams.get('fechaHasta') ?? undefined,
  });
  const key = `supabase-analytics-v1-${desde}/${hasta}`;

  try {
    const data = await withCache(key, () => fetchSupabaseAnalytics(desde, hasta), CACHE_TTL);
    return NextResponse.json({ ok: true, configured: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[supabase-analytics]', message);
    return NextResponse.json({ ok: false, configured: true, error: message }, { status: 500 });
  }
}
