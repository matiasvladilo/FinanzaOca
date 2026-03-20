/**
 * GET /api/produccion-data
 *
 * Combina tres fuentes de datos para el dashboard de producción:
 *   1. Supabase (ConectOca) → ventas: orders + order_items + production_areas
 *   2. Google Sheets "Facturas" → costos/gastos de insumos
 *   3. Google Sheets "MERMA"    → merma por local
 *
 * Query params (modo mes):
 *   mesDesde  → "YYYY-MM"  (default: hace 2 meses)
 *   mesHasta  → "YYYY-MM"  (default: mes actual)
 * Query params (modo fecha):
 *   fechaDesde → "YYYY-MM-DD"
 *   fechaHasta → "YYYY-MM-DD"
 *   (si se envían fechaDesde/fechaHasta, tienen prioridad sobre mesDesde/mesHasta)
 * Común:
 *   local  → "todos" | "PV" | "La Reina" | "PT" | "Bilbao"
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, getProduccionConfig } from '@/lib/google-sheets';
import { parseMonto, parseFecha, getMesLabel, findHeader } from '@/lib/data/parsers';
import { getSupabaseClient } from '@/lib/supabase';

const COLORES = ['#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444', '#06B6D4', '#D1D5DB'];

// ── Rango de fechas ──────────────────────────────────────────────────────────
function getDateRange(params: {
  mesDesde?: string; mesHasta?: string;
  fechaDesde?: string; fechaHasta?: string;
}) {
  // Modo fecha específica (YYYY-MM-DD) tiene prioridad
  if (params.fechaDesde && params.fechaHasta) {
    const [dy, dm, dd] = params.fechaDesde.split('-').map(Number);
    const [hy, hm, hd] = params.fechaHasta.split('-').map(Number);
    return {
      desde: new Date(dy, dm - 1, dd, 0, 0, 0, 0),
      hasta: new Date(hy, hm - 1, hd, 23, 59, 59, 999),
    };
  }
  // Modo mes (YYYY-MM)
  const mesDesde = params.mesDesde ?? '';
  const mesHasta = params.mesHasta ?? '';
  const [dy, dm] = mesDesde.split('-').map(Number);
  const [hy, hm] = mesHasta.split('-').map(Number);
  return {
    desde: new Date(dy, dm - 1, 1, 0, 0, 0, 0),
    hasta: new Date(hy, hm, 0, 23, 59, 59, 999), // último día del mes
  };
}

// ── Fetch gastos de Facturas (planilla de producción) ────────────────────────
async function fetchGastos(local: string, desde: Date, hasta: Date) {
  const config = getProduccionConfig();
  if (!config) return [];

  const allRows = await readSheet(config.id, 'Facturas!A1:N5000');
  if (allRows.length < 2) return [];
  // Buscar la fila que tenga headers reales (contiene "Local" o "Fecha" o "Proveedor")
  const knownHeaders = ['local', 'fecha', 'proveedor', 'gasto', 'tipo'];
  const headerIdx = allRows.findIndex(r =>
    r.some(c => knownHeaders.includes((c ?? '').toLowerCase().trim()))
  );
  if (headerIdx === -1 || headerIdx >= allRows.length - 1) return [];
  const headers = allRows[headerIdx];
  const data = allRows.slice(headerIdx + 1);
  const idx = {
    local:         findHeader(headers, 'Local', 'LOCAL', 'local'),
    fechaVenc:     findHeader(headers, 'Fecha vencimiento', 'Fecha Vencimiento', 'FECHA VENCIMIENTO', 'Fecha', 'FECHA', 'fecha'),
    tipo:          findHeader(headers, 'Gasto', 'Tipo (Ingreso/Gasto)', 'TIPO', 'tipo', 'Tipo'),
    monto:         findHeader(headers, 'Total factura', 'Total Factura', 'Monto', 'MONTO', 'monto'),
    mes:           findHeader(headers, 'Mes', 'MES', 'mes'),
    proveedor:     findHeader(headers, 'Proveedor', 'Proveedor/Cliente', 'proveedor'),
  };
  const filterLocal = local && local !== 'todos' && local !== 'Todos' ? local.toLowerCase() : null;
  return data
    .filter(r => r[idx.monto] && (idx.tipo === -1 || (r[idx.tipo] ?? '').toLowerCase().includes('gasto')))
    .map(r => {
      const fp = parseFecha(r[idx.fechaVenc] ?? '');
      return {
        local:     r[idx.local] ?? '',
        fecha:     r[idx.fechaVenc] ?? '',
        monto:     parseMonto(r[idx.monto] ?? ''),
        mes:       fp.mes || parseInt(r[idx.mes] ?? '0', 10),
        anio:      fp.anio,
        date:      fp.date,
        proveedor: r[idx.proveedor] ?? '',
      };
    })
    .filter(r => r.date && r.date >= desde && r.date <= hasta)
    .filter(r => !filterLocal || r.local.toLowerCase() === filterLocal);
}

// ── Fetch merma (planilla de producción) ─────────────────────────────────────
async function fetchMerma(local: string, desde: Date, hasta: Date) {
  const config = getProduccionConfig();
  if (!config) return [];

  const allRows = await readSheet(config.id, 'Merma!A1:H5000');
  if (allRows.length < 2) return [];
  const knownHeadersMerma = ['local', 'fecha', 'producto', 'monto', 'tipo', 'merma'];
  const headerIdx = allRows.findIndex(r =>
    r.some(c => knownHeadersMerma.includes((c ?? '').toLowerCase().trim()))
  );
  if (headerIdx === -1 || headerIdx >= allRows.length - 1) return [];
  const headers = allRows[headerIdx];
  const data = allRows.slice(headerIdx + 1);
  const idx = {
    local:    findHeader(headers, 'Local', 'LOCAL', 'local'),
    producto: findHeader(headers, 'PRODUCTO', 'Producto', 'producto', 'Columna 1'),
    tipo:     findHeader(headers, 'TIPO', 'tipo', 'Tipo'),
    monto:    findHeader(headers, 'MONTO', 'monto', 'Monto', 'Total'),
    fecha:    findHeader(headers, 'FECHA', 'Fecha', 'fecha'),
    mes:      findHeader(headers, 'MES', 'Mes', 'mes'),
  };
  const filterLocal = local && local !== 'todos' && local !== 'Todos' ? local.toLowerCase() : null;
  return data
    .filter(r => r[idx.monto])
    .map(r => {
      const fp = parseFecha(r[idx.fecha] ?? '');
      return {
        local:    r[idx.local] ?? '',
        producto: r[idx.producto] ?? '',
        tipo:     r[idx.tipo]     ?? 'Sin tipo',
        monto:    parseMonto(r[idx.monto] ?? ''),
        fecha:    r[idx.fecha]    ?? '',
        mes:      fp.mes || parseInt(r[idx.mes] ?? '0', 10),
        anio:     fp.anio,
        date:     fp.date,
      };
    })
    .filter(r => r.date && r.date >= desde && r.date <= hasta)
    .filter(r => !filterLocal || r.local.toLowerCase() === filterLocal);
}

// ── Fetch ventas desde Supabase (ConectOca) ──────────────────────────────────
async function fetchVentasSupabase(desdeStr: string, hastaStr: string) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return { orders: [], items: [], areaMap: {} as Record<string, string>, productCategoryMap: {} as Record<string, string> };
  }
  const db = getSupabaseClient();
  const [ordersRes, itemsRes, categoriesRes, productsRes] = await Promise.all([
    db.from('orders')
      .select('created_at, total, status')
      .gte('created_at', desdeStr)
      .lte('created_at', hastaStr),
    db.from('order_items')
      .select('product_id, product_name, quantity, price, created_at')
      .gte('created_at', desdeStr)
      .lte('created_at', hastaStr),
    db.from('categories').select('id, name'),
    db.from('products').select('id, category_id'),
  ]);

  // category_id → nombre normalizado
  const categoryMap: Record<string, string> = {};
  for (const c of (categoriesRes.data ?? [])) {
    const id   = String((c as Record<string, unknown>).id   ?? '');
    const name = String((c as Record<string, unknown>).name ?? '');
    // Normalizar: PANADERIA/panaderia → Panadería, PASTELERIA → Pastelería, EMPANADAS → Empanadas
    const normalized = name.toUpperCase().includes('PASTELERIA') ? 'Pastelería'
                     : name.toUpperCase().includes('PANADERIA')  ? 'Panadería'
                     : name.toUpperCase().includes('EMPANADA')   ? 'Empanadas'
                     : name;
    if (id) categoryMap[id] = normalized;
  }

  // product_id → category name
  const productCategoryMap: Record<string, string> = {};
  for (const p of (productsRes.data ?? [])) {
    const pid = String((p as Record<string, unknown>).id          ?? '');
    const cid = String((p as Record<string, unknown>).category_id ?? '');
    if (pid) productCategoryMap[pid] = cid ? (categoryMap[cid] ?? 'Otros') : 'Otros';
  }

  return {
    orders:             (ordersRes.data ?? []) as Record<string, unknown>[],
    items:              (itemsRes.data  ?? []) as Record<string, unknown>[],
    productCategoryMap,
  };
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const local = searchParams.get('local') ?? 'todos';

    // Calcular mes actual y hace 2 meses como default
    const hoy = new Date();
    const defaultHasta = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    const d2 = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    const defaultDesde = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}`;

    const mesDesde   = searchParams.get('mesDesde')   ?? defaultDesde;
    const mesHasta   = searchParams.get('mesHasta')   ?? defaultHasta;
    const fechaDesde = searchParams.get('fechaDesde') ?? '';
    const fechaHasta = searchParams.get('fechaHasta') ?? '';

    const { desde, hasta } = getDateRange({ mesDesde, mesHasta, fechaDesde, fechaHasta });
    const desdeStr = desde.toISOString().slice(0, 10);
    const hastaStr = hasta.toISOString().slice(0, 10);

    // Fetch en paralelo
    const [gastos, mermaData, ventasData] = await Promise.all([
      fetchGastos(local, desde, hasta),
      fetchMerma(local, desde, hasta),
      fetchVentasSupabase(desdeStr, hastaStr),
    ]);

    const { orders, items, productCategoryMap } = ventasData;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalCostos = gastos.reduce((s, r) => s + r.monto, 0);
    const totalMerma  = mermaData.reduce((s, r) => s + r.monto, 0);
    const totalVentas = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const totalPedidos = orders.length;
    const rentabilidad = totalVentas > 0
      ? Math.round(((totalVentas - totalCostos - totalMerma) / totalVentas) * 100)
      : 0;

    // ── Ventas por mes (Supabase) ─────────────────────────────────────────────
    const ventasMesMap: Record<string, { ventas: number; pedidos: number }> = {};
    for (const o of orders) {
      const mes = String(o.created_at ?? '').slice(0, 7);
      if (!mes || mes.length !== 7) continue;
      if (!ventasMesMap[mes]) ventasMesMap[mes] = { ventas: 0, pedidos: 0 };
      ventasMesMap[mes].ventas  += Number(o.total ?? 0);
      ventasMesMap[mes].pedidos += 1;
    }
    const ventasPorMes = Object.entries(ventasMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [anio, mes] = key.split('-');
        return { key, mes: getMesLabel(parseInt(mes), parseInt(anio)), ...v };
      });

    // ── Gastos por mes (Facturas) ─────────────────────────────────────────────
    const gastosMesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of gastos) {
      if (!r.mes || !r.anio) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!gastosMesMap[key]) gastosMesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      gastosMesMap[key].monto += r.monto;
    }
    const gastosPorMes = Object.entries(gastosMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Merma por mes ─────────────────────────────────────────────────────────
    const mermaMesMap: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of mermaData) {
      if (!r.mes || !r.anio) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!mermaMesMap[key]) mermaMesMap[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      mermaMesMap[key].monto += r.monto;
    }
    const mermasPorMes = Object.entries(mermaMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, mes: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Top productos (Supabase order_items) ──────────────────────────────────
    const prodMap: Record<string, { nombre: string; categoria: string; unidades: number; ingresos: number }> = {};
    for (const item of items) {
      const nombre    = String(item.product_name ?? '(sin nombre)');
      const cant      = Number(item.quantity ?? 0);
      const precio    = Number(item.price    ?? 0);
      const categoria = productCategoryMap[String(item.product_id ?? '')] ?? 'Otros';
      if (!prodMap[nombre]) prodMap[nombre] = { nombre, categoria, unidades: 0, ingresos: 0 };
      prodMap[nombre].unidades += cant;
      prodMap[nombre].ingresos += cant * precio;
    }
    const topProductos = Object.values(prodMap)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 15);

    // ── Por categoría ─────────────────────────────────────────────────────────
    const categoriaVentasMap: Record<string, { unidades: number; ingresos: number }> = {};
    for (const item of items) {
      const categoria = productCategoryMap[String(item.product_id ?? '')] ?? 'Otros';
      const cant      = Number(item.quantity ?? 0);
      const precio    = Number(item.price    ?? 0);
      if (!categoriaVentasMap[categoria]) categoriaVentasMap[categoria] = { unidades: 0, ingresos: 0 };
      categoriaVentasMap[categoria].unidades += cant;
      categoriaVentasMap[categoria].ingresos += cant * precio;
    }
    const porArea = Object.entries(categoriaVentasMap)
      .sort(([, a], [, b]) => b.ingresos - a.ingresos)
      .map(([area, v], i) => ({ area, ...v, color: COLORES[i % COLORES.length] }));

    // ── Merma por tipo ────────────────────────────────────────────────────────
    const mermaMap: Record<string, number> = {};
    for (const r of mermaData) mermaMap[r.tipo] = (mermaMap[r.tipo] ?? 0) + r.monto;
    const porTipoMerma = Object.entries(mermaMap)
      .sort(([, a], [, b]) => b - a)
      .map(([tipo, monto], i) => ({
        tipo, monto,
        porcentaje: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
        color: COLORES[i % COLORES.length],
      }));

    // Locales únicos presentes en la planilla de producción
    const localesSet = new Set<string>();
    for (const r of gastos)    if (r.local) localesSet.add(r.local);
    for (const r of mermaData) if (r.local) localesSet.add(r.local);
    const locales = ['Todos', ...[...localesSet].sort()];

    return NextResponse.json({
      ok: true,
      kpi: { totalVentas, totalCostos, totalMerma, rentabilidad, totalPedidos },
      ventasPorMes,
      gastosPorMes,
      mermasPorMes,
      topProductos,
      porArea,
      porTipoMerma,
      locales,
      mesDesde,
      mesHasta,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[produccion-data]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
