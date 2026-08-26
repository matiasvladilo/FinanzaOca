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
import { fetchGastosFacturas, topProveedores } from '@/lib/data/gastos';
import { parseMonto, parseFecha, getMesLabel, findHeader, agruparMontosPorTexto } from '@/lib/data/parsers';
import { getSupabaseClient } from '@/lib/supabase';
import { getControlPanClient } from '@/lib/supabase-controlpan';
import { requireAuth } from '@/lib/auth-api';
import { limitesUtcDelRango, ultimoDiaDelMes } from '@/lib/date-utils';

/**
 * Rango para consultar ConectOca.
 *
 * `orders.created_at` es timestamptz, así que hay que acotar por instantes y no
 * por fechas sueltas, y los límites son la medianoche **de Chile**: agosto es
 * agosto acá, no en UTC.
 *
 * OJO: esto NO sirve para las planillas de Google Sheets. Ahí las fechas no
 * tienen hora y se comparan como calendario — por eso `desde`/`hasta` siguen
 * viajando aparte a fetchGastos/fetchMerma/fetchControlPan.
 */
function rangoSupabase(
  mesDesde: string, mesHasta: string,
  fechaDesde: string, fechaHasta: string,
): { desdeISO: string; hastaISO: string } {
  if (fechaDesde && fechaHasta) return limitesUtcDelRango(fechaDesde, fechaHasta);
  const [hy, hm] = mesHasta.split('-').map(Number);
  const ultimo = String(ultimoDiaDelMes(hy, hm)).padStart(2, '0');
  return limitesUtcDelRango(`${mesDesde}-01`, `${mesHasta}-${ultimo}`);
}

const COLORES = ['#3B82F6', '#8B5CF6', '#10B981', '#F97316', '#EF4444', '#06B6D4', '#D1D5DB'];

// ── Categorías de Distribuidora, excluidas de todos los análisis ─────────────
//
// Bebidas se excluía por nombre ("Bebidas" tipeado literal). Cuando ConectOca
// la renombró a "Bebidas y Aguas" y le sumó 7 hermanas (Abarrotes, Lácteos,
// Limpieza, Hogar, Snacks, Galletas y cereales, Dulces y Chocolates) — todas
// reselló de Distribuidora, no producción propia — un match por nombre exacto
// se habría roto igual, y encima habría dejado pasar a las 7 nuevas. La
// relación real está en el dato: todas cuelgan de la categoría "DISTRIBUIDORA"
// vía parent_id. Se usa esa relación en vez de una lista de nombres, para que
// una subcategoría nueva quede afuera sola, sin tocar código.
interface CategoriaRaw { id: string; name: string; parent_id: string | null }

function esCategoriaDistribuidora(id: string, porId: Map<string, CategoriaRaw>): boolean {
  let cur = porId.get(id);
  let guard = 0; // corta ante un parent_id circular por dato corrupto
  while (cur && guard++ < 10) {
    if (cur.name.trim().toUpperCase() === 'DISTRIBUIDORA') return true;
    cur = cur.parent_id ? porId.get(cur.parent_id) : undefined;
  }
  return false;
}

// ── Rango de fechas ──────────────────────────────────────────────────────────
function getDateRange(params: {
  mesDesde?: string; mesHasta?: string;
  fechaDesde?: string; fechaHasta?: string;
}) {
  // Modo fecha específica (YYYY-MM-DD) — usa UTC explícito
  if (params.fechaDesde && params.fechaHasta) {
    const [dy, dm, dd] = params.fechaDesde.split('-').map(Number);
    const [hy, hm, hd] = params.fechaHasta.split('-').map(Number);
    return {
      desde: new Date(Date.UTC(dy, dm - 1, dd, 0, 0, 0, 0)),
      hasta: new Date(Date.UTC(hy, hm - 1, hd, 23, 59, 59, 999)),
    };
  }
  // Modo mes (YYYY-MM) — usa UTC explícito para evitar drift de timezone
  const mesDesde = params.mesDesde ?? '';
  const mesHasta = params.mesHasta ?? '';
  const [dy, dm] = mesDesde.split('-').map(Number);
  const [hy, hm] = mesHasta.split('-').map(Number);
  return {
    desde: new Date(Date.UTC(dy, dm - 1, 1, 0, 0, 0, 0)),
    hasta: new Date(Date.UTC(hy, hm, 0, 23, 59, 59, 999)), // último ms del mes
  };
}

// ── Fetch gastos de Facturas (planilla de producción) ────────────────────────
// El parseo vive en @/lib/data/gastos porque la planilla de Distribuidora usa
// el mismo formato y comparte la lógica.
async function fetchGastos(local: string, desde: Date, hasta: Date) {
  const config = getProduccionConfig();
  if (!config) return [];
  return fetchGastosFacturas(config.id, local, desde, hasta);
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

const OCA_BUSINESS_ID = 'd1fa7f40-c5e1-4bc2-9ffc-c8483950b758';

// ── Normalización de nombres de categoría ─────────────────────────────────────
function normalizeCat(name: string): string {
  const u = name.toUpperCase();
  if (u.includes('PANADERIA') || u.includes('PANADERÍA')) return 'Panadería';
  if (u.includes('PASTELERIA') || u.includes('PASTELERÍA')) return 'Pastelería';
  if (u.includes('EMPANADA')) return 'Empanadas';
  if (u.includes('BEBIDA')) return 'Bebidas';
  return name;
}

// ── Fetch ventas desde Supabase (ConectOca) ──────────────────────────────────
export async function fetchVentasSupabase(desdeStr: string, hastaStr: string) {
  // getSupabaseClient() acepta service_role o anon — pedir anon sí o sí hacía
  // que devolviera vacío en silencio si solo estaba configurada la service_role.
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    return { orders: [], items: [], productCategoryMap: {} as Record<string, string>, categoriasExcluidas: new Set<string>(), accountNameMap: {} as Record<string, string> };
  }
  const db = getSupabaseClient();

  const [categoriesRes, productsRes, profilesRes] = await Promise.all([
    db.from('categories').select('id, name, parent_id'),
    db.from('products').select('id, category_id'),
    // Cada sucursal pide con SU PROPIA cuenta (role='local') — profiles.id
    // es el mismo auth.users.id que orders.user_id, aunque PostgREST no
    // pueda hacer el embed automático porque la FK real de orders es hacia
    // auth.users, no hacia profiles. Por eso se resuelve a mano acá con un
    // mapa, en vez de un join anidado en el select de orders.
    db.from('profiles').select('id, name'),
  ]);

  // Orders + sus items, en una sola consulta paginada.
  //
  // Dos cosas acá son imprescindibles y no se pueden simplificar:
  //
  // 1. PAGINAR. PostgREST corta las respuestas en 1000 filas por configuración
  //    del servidor; un .limit(50000) NO levanta ese techo, solo lo pide. Sin
  //    paginar, las ventas quedaban subcontadas.
  //
  // 2. ORDENAR EXPLÍCITAMENTE. Postgres no garantiza ningún orden sin ORDER BY,
  //    así que entre páginas de .range() se repetían y se perdían filas — los
  //    totales cambiaban en cada refresco. created_at solo no alcanza porque
  //    tiene timestamps repetidos: hace falta el id como desempate para que el
  //    orden sea total y la paginación reproducible.
  const orders: Record<string, unknown>[] = [];
  const allItems: Record<string, unknown>[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('orders')
      .select('created_at, total, status, user_id, order_items(product_id, product_name, quantity, price)')
      .eq('business_id', OCA_BUSINESS_ID)
      .gte('created_at', desdeStr)
      .lte('created_at', hastaStr)
      .order('created_at', { ascending: true })
      .order('id',         { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('[produccion-data] orders error:', error.message); break; }
    if (!data?.length) break;
    for (const row of data as Record<string, unknown>[]) {
      const { order_items: nested, ...order } = row;
      orders.push(order);
      // Se le cuelga la fecha y el user_id del pedido a cada ítem: sin eso
      // no se puede armar ni la serie diaria ni cuánto pidió cada sucursal
      // (ver localDePedidoConectOca), porque order_items no tiene su propia
      // fecha ni cuenta utilizables.
      if (Array.isArray(nested)) {
        for (const item of nested as Record<string, unknown>[]) {
          allItems.push({ ...item, created_at: order.created_at, user_id: order.user_id });
        }
      }
    }
    if (data.length < PAGE) break;
  }
  console.log(`[produccion-data] rango: ${desdeStr} → ${hastaStr} | orders: ${orders.length} | items: ${allItems.length}`);

  // product_id → nombre de categoría normalizado, + qué categorías (por nombre
  // normalizado) cuelgan de Distribuidora — ver esCategoriaDistribuidora arriba.
  const categoriasRaw: CategoriaRaw[] = (categoriesRes.data ?? []).map(c => {
    const r = c as Record<string, unknown>;
    return { id: String(r.id ?? ''), name: String(r.name ?? ''), parent_id: r.parent_id ? String(r.parent_id) : null };
  });
  const porId = new Map(categoriasRaw.map(c => [c.id, c]));

  const categoryNameMap: Record<string, string> = {};
  const categoriasExcluidas = new Set<string>();
  for (const c of categoriasRaw) {
    if (!c.id) continue;
    const nombre = normalizeCat(c.name);
    categoryNameMap[c.id] = nombre;
    if (esCategoriaDistribuidora(c.id, porId)) categoriasExcluidas.add(nombre);
  }

  const productCategoryMap: Record<string, string> = {};
  for (const p of (productsRes.data ?? [])) {
    const r  = p as Record<string, unknown>;
    const id = String(r.id          ?? '');
    const ci = String(r.category_id ?? '');
    if (id && ci) productCategoryMap[id] = categoryNameMap[ci] ?? 'Sin área';
  }

  // user_id → nombre de la cuenta que hizo el pedido. Cada sucursal pide con
  // su propia cuenta ("LA OCA PV", "LA OCA BILBAO", "LA OCA LA REINA",
  // "Pedro Torres" para PT — confirmado con el dueño del negocio, y su email
  // real es pt@gmail.com), así que esto cubre prácticamente el 100% de los
  // pedidos — a diferencia de customer_name (campo libre, opcional, vacío en
  // la mayoría), que se probó primero y no servía para esto.
  const accountNameMap: Record<string, string> = {};
  for (const p of (profilesRes.data ?? [])) {
    const r = p as Record<string, unknown>;
    const id = String(r.id ?? '');
    if (id) accountNameMap[id] = String(r.name ?? '');
  }

  return { orders, items: allItems, productCategoryMap, categoriasExcluidas, accountNameMap };
}

/**
 * ¿"query" aparece en "nombre"? Substring simple, salvo que sea justo la
 * diferencia de un plural/singular en español (una "s" final de más o de
 * menos) — "sopaipilla" tiene que encontrar "Sopaipillas" y viceversa, sin
 * que importe cuál de las dos formas haya quedado tipeada en ConectOca. No
 * es un fuzzy-match general (no corrige tildes, typos, sinónimos): es
 * puntual para ese caso, que es el que realmente aparece con nombres de
 * productos reales.
 */
function coincideNombreProducto(nombreReal: string, query: string): boolean {
  const nombre = nombreReal.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (nombre.includes(q)) return true;
  const qAlterno = q.endsWith('s') ? q.slice(0, -1) : `${q}s`;
  return nombre.includes(qAlterno);
}

/**
 * Mapea el nombre de la cuenta que hizo un pedido de ConectOca (resuelta
 * vía accountNameMap, orders.user_id → profiles.name) a la sucursal real.
 *
 * Cada sucursal pide con SU PROPIA cuenta de ConectOca — no es un dato
 * suelto ni parcial, cubre prácticamente el 100% de los pedidos (verificado
 * contra la base real: 3.942 de 3.942 pedidos tienen user_id, y ese user_id
 * siempre resuelve a una de estas cuentas). Confirmado a mano con el dueño
 * del negocio (26/08/2026): "LA OCA PV"→PV, "LA OCA BILBAO"→Bilbao,
 * "LA OCA LA REINA"→La Reina, y "Pedro Torres" (cuenta con email real
 * pt@gmail.com, no un cliente externo) → PT.
 *
 * (Antes esto se intentó con orders.customer_name — un campo de texto libre
 * y opcional, vacío en ~80% de los pedidos. Se abandonó por accountNameMap
 * porque el nombre de la cuenta sí está siempre.)
 */
function localDePedidoConectOca(nombreCuenta: unknown): string | null {
  const s = String(nombreCuenta ?? '').trim().toUpperCase();
  if (!s) return null;
  if (s.includes('LA REINA')) return 'La Reina';
  if (s.includes('BILBAO')) return 'Bilbao';
  if (s === 'PEDRO TORRES') return 'PT';
  if (s.includes('PV')) return 'PV';
  return null;
}

export interface ProductoVentaResultado {
  nombre: string;
  categoria: string;
  unidades: number;
  ingresos: number;
  /** Cuánto pidió cada sucursal — solo los pedidos con customer_name identificable (ver localDePedidoConectOca). Cubre una parte del total, no todo. */
  porLocalIdentificado: Record<string, { unidades: number; ingresos: number }>;
  /** El resto: pedidos sin customer_name, o con uno que no matchea ninguna sucursal conocida — no significa que esa venta no haya pasado, solo que no quedó con sucursal cargada. Casi siempre es la mayor parte del total. */
  sinIdentificar: { unidades: number; ingresos: number };
}

/**
 * Busca un producto por nombre (substring, sin distinguir mayúsculas ni
 * singular/plural — ver coincideNombreProducto) en TODO el catálogo de
 * ConectOca del período — a diferencia de topProductos, que se corta en los
 * primeros 15 por volumen. La usa el asistente virtual para preguntas tipo
 * "qué porcentaje de venta son las sopaipillas", donde el producto puede no
 * estar entre los más vendidos.
 *
 * A propósito NO excluye la familia Distribuidora (categoriasExcluidas): si
 * preguntan puntualmente por un producto, la respuesta tiene que ser real
 * sin importar en qué categoría cayó — la exclusión es para no mezclarlo con
 * el ranking de Producción, no para ocultar el dato si se pide directo.
 *
 * Incluye porLocalIdentificado/sinIdentificar (ver localDePedidoConectOca) —
 * cuánto pidió cada sucursal, sobre la parte de los pedidos que sí tiene
 * ese dato cargado (no el 100%, ver sinIdentificar).
 */
export async function buscarProductoPorNombre(
  nombre: string,
  fechaDesde: string,
  fechaHasta: string,
): Promise<ProductoVentaResultado[]> {
  const { desdeISO, hastaISO } = limitesUtcDelRango(fechaDesde, fechaHasta);
  const { items, productCategoryMap, accountNameMap } = await fetchVentasSupabase(desdeISO, hastaISO);

  const q = nombre.trim().toLowerCase();
  if (!q) return [];

  const porProducto: Record<string, ProductoVentaResultado> = {};
  for (const item of items) {
    const productName = String(item.product_name ?? '');
    if (!coincideNombreProducto(productName, q)) continue;
    const productId = String(item.product_id ?? '');
    const categoria = productCategoryMap[productId] ?? 'Sin área';
    const cant   = Number(item.quantity ?? 0);
    const precio = Number(item.price ?? 0);
    if (!porProducto[productName]) {
      porProducto[productName] = {
        nombre: productName, categoria, unidades: 0, ingresos: 0,
        porLocalIdentificado: {}, sinIdentificar: { unidades: 0, ingresos: 0 },
      };
    }
    const acc = porProducto[productName];
    acc.unidades += cant;
    acc.ingresos += cant * precio;

    const local = localDePedidoConectOca(accountNameMap[String(item.user_id ?? '')]);
    if (local) {
      if (!acc.porLocalIdentificado[local]) acc.porLocalIdentificado[local] = { unidades: 0, ingresos: 0 };
      acc.porLocalIdentificado[local].unidades += cant;
      acc.porLocalIdentificado[local].ingresos += cant * precio;
    } else {
      acc.sinIdentificar.unidades += cant;
      acc.sinIdentificar.ingresos += cant * precio;
    }
  }

  return Object.values(porProducto).sort((a, b) => b.ingresos - a.ingresos);
}

// ── Fetch Control Pan ─────────────────────────────────────────────────────────
export interface ControlPanCliente {
  nombre: string;
  precioKg: number;
  kgEntregados: number;
  deudaTotal: number;
  totalPagado: number;
  saldoPendiente: number;
  porcentajePagado: number;
  estado: string;
}
export interface ControlPanSalidaCliente {
  local: string;
  kg: number;
  deudaGenerada: number;
}
export interface ControlPanData {
  kpi: {
    totalKg: number;
    totalDeudaGenerada: number;
    totalPagado: number;
    saldoPendiente: number;
  };
  salidasPorCliente: ControlPanSalidaCliente[];
  cuentaCorriente: ControlPanCliente[];
  deudaPorMes: Record<string, number>;
}

async function fetchControlPan(desde: Date, hasta: Date): Promise<ControlPanData | null> {
  const db = getControlPanClient();
  if (!db) return null;

  const desdeStr = desde.toISOString().slice(0, 10);
  const hastaStr = hasta.toISOString().slice(0, 10);

  const [salidasRes, pagosRes, localesRes] = await Promise.all([
    db.from('salidas').select('local, kg, deuda, fecha').gte('fecha', desdeStr).lte('fecha', hastaStr),
    db.from('pagos').select('local, monto').gte('fecha', desdeStr).lte('fecha', hastaStr),
    db.from('locales').select('nombre, precio').eq('estado', 'ACTIVO'),
  ]);

  // ── SALIDAS: agrupar por local y por mes ──────────────────────────────────
  const clienteMap: Record<string, ControlPanSalidaCliente> = {};
  const deudaPorMes: Record<string, number> = {};
  for (const row of salidasRes.data ?? []) {
    const localName = (row.local ?? '').trim();
    if (!localName) continue;
    if (!clienteMap[localName]) clienteMap[localName] = { local: localName, kg: 0, deudaGenerada: 0 };
    clienteMap[localName].kg            += Number(row.kg)    || 0;
    clienteMap[localName].deudaGenerada += Number(row.deuda) || 0;
    const mesKey = String(row.fecha ?? '').slice(0, 7);
    if (mesKey.length === 7) deudaPorMes[mesKey] = (deudaPorMes[mesKey] ?? 0) + (Number(row.deuda) || 0);
  }
  const salidasPorCliente = Object.values(clienteMap)
    .filter(c => c.kg > 0)
    .sort((a, b) => b.kg - a.kg);

  // ── PAGOS: agrupar por local ──────────────────────────────────────────────
  let totalPagado = 0;
  const pagosClienteMap: Record<string, number> = {};
  for (const row of pagosRes.data ?? []) {
    const monto = Number(row.monto) || 0;
    totalPagado += monto;
    if (row.local) pagosClienteMap[row.local] = (pagosClienteMap[row.local] ?? 0) + monto;
  }

  // ── PRECIO KG: desde tabla locales ───────────────────────────────────────
  const precioKgMap: Record<string, number> = {};
  for (const l of localesRes.data ?? []) {
    precioKgMap[l.nombre] = Number(l.precio) || 0;
  }

  // ── CUENTA CORRIENTE ──────────────────────────────────────────────────────
  const cuentaCorriente: ControlPanCliente[] = salidasPorCliente.map(c => {
    const pagado = pagosClienteMap[c.local] ?? 0;
    const saldo  = Math.max(0, c.deudaGenerada - pagado);
    const pct    = c.deudaGenerada > 0 ? Math.round((pagado / c.deudaGenerada) * 100) : 0;
    const estado = saldo === 0 ? '✅ Pagado' : pct >= 50 ? '🟡 Pago parcial' : '🔴 Pendiente';
    return {
      nombre:           c.local,
      precioKg:         precioKgMap[c.local] ?? 0,
      kgEntregados:     c.kg,
      deudaTotal:       c.deudaGenerada,
      totalPagado:      pagado,
      saldoPendiente:   saldo,
      porcentajePagado: pct,
      estado,
    };
  });

  const totalKg            = salidasPorCliente.reduce((s, c) => s + c.kg, 0);
  const totalDeudaGenerada = salidasPorCliente.reduce((s, c) => s + c.deudaGenerada, 0);
  const saldoPendiente     = Math.max(0, totalDeudaGenerada - totalPagado);

  return { kpi: { totalKg, totalDeudaGenerada, totalPagado, saldoPendiente }, salidasPorCliente, cuentaCorriente, deudaPorMes };
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Modo ligero: solo devuelve los meses con datos en Facturas + Supabase
  if (req.nextUrl.searchParams.get('soloMeses') === '1') {
    try {
      const mesesSet = new Set<string>();

      // Meses desde Facturas (Google Sheets)
      const config = getProduccionConfig();
      if (config) {
        const allRows = await readSheet(config.id, 'Facturas!A1:N5000');
        const knownHeaders = ['local', 'fecha', 'proveedor', 'gasto', 'tipo'];
        const headerIdx = allRows.findIndex(r =>
          r.some(c => knownHeaders.includes((c ?? '').toLowerCase().trim()))
        );
        if (headerIdx !== -1) {
          const headers = allRows[headerIdx];
          const iFecha = findHeader(headers, 'Fecha vencimiento', 'Fecha Vencimiento', 'Fecha', 'FECHA', 'fecha');
          const iMes   = findHeader(headers, 'Mes', 'MES', 'mes');
          for (const row of allRows.slice(headerIdx + 1)) {
            const fp = parseFecha(row[iFecha] ?? '');
            if (fp.anio && fp.mes) {
              mesesSet.add(`${fp.anio}-${String(fp.mes).padStart(2, '0')}`);
            } else {
              const mesNum = parseInt(row[iMes] ?? '', 10);
              // fallback: no podemos conocer el año solo del número de mes
              if (!isNaN(mesNum)) { /* skip — sin año no podemos construir la key */ }
            }
          }
        }
      }

      // Meses desde Supabase (ventas ConnectOca)
      try {
        const db = getSupabaseClient();
        const { data } = await db
          .from('orders')
          .select('created_at')
          .eq('business_id', OCA_BUSINESS_ID)
          .order('created_at', { ascending: true })
          .limit(50000);
        for (const o of (data ?? [])) {
          const mes = String((o as Record<string, unknown>).created_at ?? '').slice(0, 7);
          if (mes.length === 7) mesesSet.add(mes);
        }
      } catch { /* Si Supabase falla, devolvemos los de la planilla */ }

      return NextResponse.json({ ok: true, meses: [...mesesSet].sort() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      return NextResponse.json({ ok: false, meses: [], error: msg }, { status: 500 });
    }
  }

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
    const { desdeISO, hastaISO } = rangoSupabase(mesDesde, mesHasta, fechaDesde, fechaHasta);

    // Fetch en paralelo
    const [gastos, mermaData, ventasData, controlPan] = await Promise.all([
      fetchGastos(local, desde, hasta),
      fetchMerma(local, desde, hasta),
      fetchVentasSupabase(desdeISO, hastaISO),
      fetchControlPan(desde, hasta),
    ]);

    const { orders, items, productCategoryMap, categoriasExcluidas, accountNameMap } = ventasData;

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const totalCostos     = gastos.reduce((s, r) => s + r.monto, 0);
    const totalMerma      = mermaData.reduce((s, r) => s + r.monto, 0);
    // Ventas ConectOca: orders.total como base confiable, menos la parte de
    // Distribuidora (bebidas y el resto de sus subcategorías, calculada por ítems)
    const totalOrdersSum  = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const bebidasItems    = items.reduce((s, item) => {
      const productId = String(item.product_id ?? '');
      const categoria = productCategoryMap[productId] ?? 'Sin área';
      if (!categoriasExcluidas.has(categoria)) return s;
      return s + Number(item.quantity ?? 0) * Number(item.price ?? 0);
    }, 0);
    const ventasConectOca = totalOrdersSum - bebidasItems;
    const totalPedidos    = orders.length;
    // Pan externo: se usa deuda total generada (= lo vendido, independiente de cobro)
    const panExternoKpi   = controlPan?.kpi.totalDeudaGenerada ?? 0;
    const totalVentas     = ventasConectOca + panExternoKpi;
    const rentabilidad    = totalVentas > 0
      ? Math.round(((totalVentas - totalCostos - totalMerma) / totalVentas) * 100)
      : 0;

    // ── Ventas por mes: (orders.total - bebidas del mes) + pan externo del mes ──
    // Los items no tienen created_at propio, así que distribuimos bebidasItems
    // de forma proporcional al peso de cada mes sobre el total de orders.
    const ventasMesMap: Record<string, { ventas: number; bebidasRaw: number; pedidos: number }> = {};
    for (const o of orders) {
      const mes = String(o.created_at ?? '').slice(0, 7);
      if (!mes || mes.length !== 7) continue;
      if (!ventasMesMap[mes]) ventasMesMap[mes] = { ventas: 0, bebidasRaw: 0, pedidos: 0 };
      ventasMesMap[mes].ventas  += Number(o.total ?? 0);
      ventasMesMap[mes].pedidos += 1;
    }
    // Acumular bebidas por mes usando el created_at del orden padre
    // Para eso necesitamos un mapa order_id → mes. Lo hacemos con los orders que ya tenemos.
    // Como items no tienen created_at, usamos una distribución proporcional al total de bebidas:
    // distribuimos bebidasItems en los meses según el peso de orders.total de cada mes.
    const totalOrdersSumLocal = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    for (const [mes, v] of Object.entries(ventasMesMap)) {
      const peso = totalOrdersSumLocal > 0 ? v.ventas / totalOrdersSumLocal : 0;
      ventasMesMap[mes].bebidasRaw = bebidasItems * peso;
    }
    const panExternoPorMes = controlPan?.deudaPorMes ?? {};
    const ventasPorMes = Object.entries(ventasMesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [anio, mes] = key.split('-');
        const ventasCorregidas = v.ventas - v.bebidasRaw + (panExternoPorMes[key] ?? 0);
        return { key, mes: getMesLabel(parseInt(mes), parseInt(anio)), ventas: ventasCorregidas, pedidos: v.pedidos };
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

    // ── Top productos (Supabase order_items) ─────────────────────────────────
    const prodMap: Record<string, ProductoVentaResultado> = {};
    // Serie diaria por producto, para poder responder "cuánto se vendió de X".
    // Sparse a propósito: sólo los días con venta. Medido sobre el histórico
    // completo son ~7.800 celdas (~245 KB); acotado a un mes, ~35 KB.
    const porDia: Record<string, Record<string, { unidades: number; ingresos: number }>> = {};
    let totalUnidades = 0;
    for (const item of items) {
      const nombre    = String(item.product_name ?? '(sin nombre)');
      const cant      = Number(item.quantity ?? 0);
      const precio    = Number(item.price    ?? 0);
      const productId = String(item.product_id ?? '');
      const categoria = productCategoryMap[productId] ?? 'Sin área';
      if (categoriasExcluidas.has(categoria)) continue;
      if (!prodMap[nombre]) {
        prodMap[nombre] = {
          nombre, categoria, unidades: 0, ingresos: 0,
          porLocalIdentificado: {}, sinIdentificar: { unidades: 0, ingresos: 0 },
        };
      }
      const acc = prodMap[nombre];
      acc.unidades += cant;
      acc.ingresos += cant * precio;
      totalUnidades += cant;

      // Cuánto pidió cada sucursal (ver localDePedidoConectOca) — resuelto
      // vía la cuenta que hizo el pedido, cubre prácticamente el 100%.
      const local = localDePedidoConectOca(accountNameMap[String(item.user_id ?? '')]);
      if (local) {
        if (!acc.porLocalIdentificado[local]) acc.porLocalIdentificado[local] = { unidades: 0, ingresos: 0 };
        acc.porLocalIdentificado[local].unidades += cant;
        acc.porLocalIdentificado[local].ingresos += cant * precio;
      } else {
        acc.sinIdentificar.unidades += cant;
        acc.sinIdentificar.ingresos += cant * precio;
      }

      const dia = String(item.created_at ?? '').slice(0, 10);
      if (dia) {
        if (!porDia[nombre]) porDia[nombre] = {};
        if (!porDia[nombre][dia]) porDia[nombre][dia] = { unidades: 0, ingresos: 0 };
        porDia[nombre][dia].unidades += cant;
        porDia[nombre][dia].ingresos += cant * precio;
      }
    }
    // Lista completa, ordenada por unidades. `topProductos` se mantiene como los
    // primeros 15 porque el panel de Resumen y los informes ya lo consumen así.
    const productos = Object.values(prodMap).sort((a, b) => b.unidades - a.unidades);
    const topProductos = productos.slice(0, 15);

    // ── Por área de producción ────────────────────────────────────────────────
    const categoriaVentasMap: Record<string, { unidades: number; ingresos: number }> = {};
    for (const item of items) {
      const productId = String(item.product_id ?? '');
      const categoria = productCategoryMap[productId] ?? 'Sin área';
      if (categoriasExcluidas.has(categoria)) continue;
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
    // Mismo motivo tipeado distinto en cada carga ("Corporativo" / "corporativo")
    // no debe partirse en dos categorías — ver agruparMontosPorTexto.
    const porTipoMerma = agruparMontosPorTexto(mermaData.map(r => ({ texto: r.tipo, monto: r.monto })))
      .map(({ nombre, monto }, i) => ({
        tipo: nombre, monto,
        porcentaje: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
        color: COLORES[i % COLORES.length],
      }));

    // Locales únicos presentes en la planilla de producción
    const localesSet = new Set<string>();
    for (const r of gastos)    if (r.local) localesSet.add(r.local);
    for (const r of mermaData) if (r.local) localesSet.add(r.local);
    const locales = ['Todos', ...[...localesSet].sort()];

    // ── Top proveedores (Facturas de producción) ──────────────────────────────
    const topProveedoresProd = topProveedores(gastos);

    return NextResponse.json({
      ok: true,
      kpi: { totalVentas, totalCostos, totalMerma, rentabilidad, totalPedidos, totalUnidades },
      ventasPorMes,
      gastosPorMes,
      mermasPorMes,
      topProductos,
      productos,
      productosPorDia: porDia,
      porArea,
      porTipoMerma,
      topProveedoresProd,
      controlPan,
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

// ── Función reutilizable para informes ────────────────────────────────────────

export interface ProduccionReportData {
  topProductos: Array<{ nombre: string; categoria: string; unidades: number; ingresos: number }>;
  totalPedidos: number;
}

export async function fetchTopProductosForReport(fechaDesde: string, fechaHasta: string): Promise<ProduccionReportData> {
  try {
    const { orders, items, productCategoryMap, categoriasExcluidas } = await fetchVentasSupabase(fechaDesde, fechaHasta);

    const totalPedidos = orders.length;

    const prodMap: Record<string, { nombre: string; categoria: string; unidades: number; ingresos: number }> = {};
    for (const item of items) {
      const nombre    = String(item.product_name ?? '(sin nombre)');
      const cant      = Number(item.quantity ?? 0);
      const precio    = Number(item.price    ?? 0);
      const productId = String(item.product_id ?? '');
      const categoria = productCategoryMap[productId] ?? 'Sin área';
      if (categoriasExcluidas.has(categoria)) continue;
      if (!prodMap[nombre]) prodMap[nombre] = { nombre, categoria, unidades: 0, ingresos: 0 };
      prodMap[nombre].unidades += cant;
      prodMap[nombre].ingresos += cant * precio;
    }

    const topProductos = Object.values(prodMap)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    return { topProductos, totalPedidos };
  } catch (err) {
    console.error('[produccion-data] fetchTopProductosForReport:', err);
    return { topProductos: [], totalPedidos: 0 };
  }
}

// ── Función completa para inyectar Producción en el informe ──────────────────

export interface ProduccionReportDataFull {
  topProductos: Array<{ nombre: string; categoria: string; unidades: number; ingresos: number }>;
  totalPedidos: number;
  ventasConectOca: number;
  panExterno: number;
  totalVentas: number;
  gastos: number;
  deudaPendiente: number;
}

export async function fetchProduccionForReport(fechaDesde: string, fechaHasta: string): Promise<ProduccionReportDataFull> {
  const empty: ProduccionReportDataFull = {
    topProductos: [], totalPedidos: 0,
    ventasConectOca: 0, panExterno: 0, totalVentas: 0, gastos: 0, deudaPendiente: 0,
  };
  try {
    // Fechas calendario para las planillas (no tienen hora)…
    const [dy, dm, dd] = fechaDesde.split('-').map(Number);
    const [hy, hm, hd] = fechaHasta.split('-').map(Number);
    const desde = new Date(dy, dm - 1, dd, 0, 0, 0, 0);
    const hasta = new Date(hy, hm - 1, hd, 23, 59, 59, 999);
    // …e instantes en hora de Chile para ConectOca, que guarda timestamptz.
    const { desdeISO, hastaISO } = limitesUtcDelRango(fechaDesde, fechaHasta);

    const [ventasRes, gastosRes, controlPanRes] = await Promise.allSettled([
      fetchVentasSupabase(desdeISO, hastaISO),
      fetchGastos('todos', desde, hasta),
      fetchControlPan(desde, hasta),
    ]);

    const { orders, items, productCategoryMap: prodCatMap, categoriasExcluidas } = ventasRes.status === 'fulfilled'
      ? ventasRes.value
      : { orders: [], items: [], productCategoryMap: {} as Record<string, string>, categoriasExcluidas: new Set<string>() };

    // Antes esto era orders.reduce(...) sin descontar nada: el informe por
    // correo incluía Bebidas y el resto de Distribuidora en las "ventas de
    // Producción" mientras el dashboard sí las sacaba — dos números distintos
    // para la misma métrica según de dónde se mirara. Mismo criterio acá.
    const totalOrdersSum = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const distribuidoraItems = items.reduce((s, item) => {
      const productId = String(item.product_id ?? '');
      const categoria = prodCatMap[productId] ?? 'Sin área';
      if (!categoriasExcluidas.has(categoria)) return s;
      return s + Number(item.quantity ?? 0) * Number(item.price ?? 0);
    }, 0);
    const ventasConectOca = totalOrdersSum - distribuidoraItems;
    const totalPedidos    = orders.length;
    const panExterno      = controlPanRes.status === 'fulfilled' ? (controlPanRes.value?.kpi.totalDeudaGenerada ?? 0) : 0;
    const deudaPendiente  = controlPanRes.status === 'fulfilled' ? (controlPanRes.value?.kpi.saldoPendiente ?? 0) : 0;
    const totalGastos     = gastosRes.status === 'fulfilled'
      ? gastosRes.value.reduce((s, r) => s + r.monto, 0)
      : 0;

    const prodMap: Record<string, { nombre: string; categoria: string; unidades: number; ingresos: number }> = {};
    for (const item of items) {
      const nombre    = String(item.product_name ?? '(sin nombre)');
      const cant      = Number(item.quantity ?? 0);
      const precio    = Number(item.price    ?? 0);
      const productId = String(item.product_id ?? '');
      const categoria = prodCatMap[productId] ?? 'Sin área';
      if (categoriasExcluidas.has(categoria)) continue;
      if (!prodMap[nombre]) prodMap[nombre] = { nombre, categoria, unidades: 0, ingresos: 0 };
      prodMap[nombre].unidades += cant;
      prodMap[nombre].ingresos += cant * precio;
    }
    const topProductos = Object.values(prodMap)
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    return { topProductos, totalPedidos, ventasConectOca, panExterno, totalVentas: ventasConectOca + panExterno, gastos: totalGastos, deudaPendiente };
  } catch (err) {
    console.error('[produccion-data] fetchProduccionForReport:', err);
    return empty;
  }
}
