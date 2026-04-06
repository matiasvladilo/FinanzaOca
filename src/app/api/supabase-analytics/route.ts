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

const CATS_EXCLUIDAS = new Set(['Bebidas', 'bebidas', 'BEBIDAS']);

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
// Retorna fechas en formato YYYY-MM-DD (local) para evitar drift de timezone
// al comparar con Supabase (igual que produccion-data/route.ts)
const pad = (n: number) => String(n).padStart(2, '0');
function toLocalDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function resolveRango(params: {
  meses?: number;
  mesDesde?: string; mesHasta?: string;
  fechaDesde?: string; fechaHasta?: string;
}): { desde: string; hasta: string } {
  // 1) Fechas exactas (YYYY-MM-DD) — ya en formato correcto
  if (params.fechaDesde && params.fechaHasta) {
    return { desde: params.fechaDesde, hasta: params.fechaHasta };
  }
  // 2) Rango por mes (YYYY-MM)
  if (params.mesDesde && params.mesHasta) {
    const [dy, dm] = params.mesDesde.split('-').map(Number);
    const [hy, hm] = params.mesHasta.split('-').map(Number);
    const desde = new Date(dy, dm - 1, 1);                   // primer día del mes
    const hasta = new Date(hy, hm, 0);                       // último día del mes
    return { desde: toLocalDate(desde), hasta: toLocalDate(hasta) };
  }
  // 3) Fallback: N meses hacia atrás
  const meses = params.meses ?? 12;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - meses, 1);
  const f = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { desde: toLocalDate(d), hasta: toLocalDate(f) };
}

const OCA_BUSINESS_ID = 'd1fa7f40-c5e1-4bc2-9ffc-c8483950b758';

// ─── Normalización de nombres de categoría ────────────────────────────────
function normalizeCat(name: string): string {
  const u = name.toUpperCase();
  if (u.includes('PANADERIA') || u.includes('PANADERÍA')) return 'Panadería';
  if (u.includes('PASTELERIA') || u.includes('PASTELERÍA')) return 'Pastelería';
  if (u.includes('EMPANADA')) return 'Empanadas';
  if (u.includes('BEBIDA')) return 'Bebidas';
  return name;
}

// ─── Fetch principal ──────────────────────────────────────────────────────
async function fetchSupabaseAnalytics(fechaDesde: string, fechaHasta: string) {
  const db = getSupabaseClient();

  // orders, categories y products en paralelo
  const [ordersRes, categoriesRes, productsRes] = await Promise.all([
    db
      .from(SCHEMA.orders.table)
      .select([SCHEMA.orders.fecha, SCHEMA.orders.total, SCHEMA.orders.estado].join(', '))
      .eq('business_id', OCA_BUSINESS_ID)
      .gte(SCHEMA.orders.fecha, fechaDesde)
      .lte(SCHEMA.orders.fecha, fechaHasta)
      .order(SCHEMA.orders.fecha, { ascending: true })
      .limit(50000),
    db.from('categories').select('id, name'),
    db.from('products').select('id, category_id'),
  ]);

  if (ordersRes.error) throw new Error(`[orders] ${ordersRes.error.message}`);

  // ── productCategoryMap: product_id → nombre de categoría ─────────────────
  const categoryNameMap: Record<string, string> = {};
  for (const c of (categoriesRes.data ?? [])) {
    const r = c as Record<string, unknown>;
    const id   = String(r.id   ?? '');
    const name = String(r.name ?? '');
    if (id) categoryNameMap[id] = normalizeCat(name);
  }
  const productCategoryMap: Record<string, string> = {};
  for (const p of (productsRes.data ?? [])) {
    const r  = p as Record<string, unknown>;
    const id = String(r.id          ?? '');
    const ci = String(r.category_id ?? '');
    if (id && ci) productCategoryMap[id] = categoryNameMap[ci] ?? 'Sin área';
  }

  // Paginar order_items filtrando por business_id via join con orders
  const PAGE = 1000;
  const allItemsRaw: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from(SCHEMA.items.table)
      .select(`product_id, ${SCHEMA.items.productoNombre}, ${SCHEMA.items.cantidad}, ${SCHEMA.items.precioUnitario}, orders!inner(created_at)`)
      .eq('orders.business_id', OCA_BUSINESS_ID)
      .gte('orders.created_at', fechaDesde)
      .lte('orders.created_at', fechaHasta)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[items] ${error.message}`);
    if (!data?.length) break;
    const normalized = (data as Record<string, unknown>[]).map(item => ({
      ...item,
      [SCHEMA.items.fecha]: (item.orders as Record<string, unknown>)?.created_at ?? '',
    }));
    allItemsRaw.push(...normalized);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: Record<string, unknown>[] = (ordersRes.data ?? []) as any[];
  const items:  Record<string, unknown>[] = allItemsRaw;

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
    const nombre    = String(item[SCHEMA.items.productoNombre] ?? '(sin nombre)');
    const cant      = Number(item[SCHEMA.items.cantidad]       ?? 0);
    const precio    = Number(item[SCHEMA.items.precioUnitario] ?? 0);
    const productId = String(item['product_id']               ?? '');
    const cat       = productCategoryMap[productId] ?? 'Sin área';
    if (CATS_EXCLUIDAS.has(cat)) continue;
    if (!porProductoMap[nombre]) {
      porProductoMap[nombre] = { nombre, categoria: cat, unidades: 0, ingresos: 0, porSucursal: {} };
    }
    porProductoMap[nombre].unidades += cant;
    porProductoMap[nombre].ingresos += cant * precio;
  }
  const topProductos = Object.values(porProductoMap)
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 20);

  // ── Agregación: ventas por categoría ────────────────────────────────────
  const porCategoriaMap: Record<string, { unidades: number; ingresos: number }> = {};
  for (const item of items) {
    const productId = String(item['product_id'] ?? '');
    const cat       = productCategoryMap[productId] ?? 'Sin área';
    if (CATS_EXCLUIDAS.has(cat)) continue;
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
    areas: Object.keys(categoryNameMap).map(id => categoryNameMap[id]), // nombres de categorías
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
