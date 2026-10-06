# Producción/Distribuidora Double-Counting Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dashboard's "Gastos Totales" KPI so it stops double-counting Distribuidora's referencial gasto (already embedded in the 4 locales' own Facturas), stabilize Producción's per-month breakdown so it no longer depends on query date-range width, and make the "Ventas vs Gastos — Por Mes" chart match the KPI cards by summing Producción the same way they do.

**Architecture (revised after a math check with the user):** An earlier version of this plan also tried to strip Producción's intercompany sale-to-locales out of "Ventas Totales". That turned out to be wrong: the locales already record that same transaction as their own cost (línea "Panadería y Pastelería" en Facturas), so Producción's full sale and that cost cancel each other out in Margen — removing only one side of that pair *understates* margen by the full intercompany amount (~$22.6M in September), a worse distortion than the one being fixed. **Producción's ventas stay exactly as they are today (full value, no change).** The only real bug is Distribuidora's gasto: Distribuidora sells to the locales at cost (no markup), so there is nothing to cancel against — its own gasto is pure double-count and must stop being added to the consolidated total. The chart then needs to catch up to the (unchanged) KPI by summing Producción's full monthly ventas/gastos too.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Vitest, Supabase, Google Sheets API.

## Global Constraints

- Never change `DailyPerformanceChart`, `ResumenSucursales`, `DistributionTreemap` prop shapes — all fixes happen in the data layer feeding them.
- `distribuidoraGastosActivo` keeps being shown in `gastosPorSucursal['Distribuidora']` (referencial, per-entity display) — it only stops being added into the consolidated `totalGastos`.
- `ventasPorLocal['Producción']` / `totalVentas` / `distribucion` — **no changes at all.** Producción's ventas handling is correct as-is.
- Every new pure function goes through Vitest (`npm test`), following the existing convention in `src/app/api/ventas/route.test.ts` (mock `@/lib/google-sheets`, `@/lib/supabase`, `@/lib/supabase-controlpan`, `@/lib/auth-api` at module level to avoid pulling in `server-only`).

---

### Task 1: Fix the stale comment in `distribuidora-data/route.ts` (issue #5)

**Files:**
- Modify: `src/app/api/distribuidora-data/route.ts:1-12`

**Interfaces:** None — doc-only change, no behavior affected.

- [ ] **Step 1: Fix the comment**

Current text (lines 1-12):
```ts
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
 */
```

Replace with:
```ts
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
 */
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/distribuidora-data/route.ts
git commit -m "docs: corregir comentario desactualizado sobre ventas de Distribuidora"
```

---

### Task 2: Stabilize Producción's per-month breakdown (issue #4)

**Files:**
- Modify: `src/app/api/produccion-data/route.ts:595-622`
- Test: `src/app/api/produccion-data/route.test.ts` (create)

**Interfaces:**
- Produces: `calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, panExternoPorMes): { key: string; mes: string; ventas: number; pedidos: number }[]` — exported from `src/app/api/produccion-data/route.ts`. Consumed by this same file's `GET` handler, and (via the `ventasPorMes` field it feeds in the JSON response) by Task 4's chart fix in `src/app/page.tsx`.

**Root cause:** the current code distributes the "Bebidas" exclusion proportionally across months based on each month's *share of the queried date range's total*, not that month's own data — so the same month gives a different total depending on how wide a range you query (verified: September 2026 gave $25.15M queried alone vs $33.5M queried inside a 12-month range). Each item already carries its own `created_at` (copied from the parent order in `fetchVentasSupabase`, `route.ts:219`), so the fix is to bucket bebidas revenue by each item's real month directly, the same way orders are already bucketed.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/produccion-data/route.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';

// route.ts importa '@/lib/google-sheets' (tira 'server-only' bajo vitest) y
// clientes Supabase — se mockean para poder importar calcularVentasPorMes sin
// ejecutar I/O real, mismo criterio que src/app/api/ventas/route.test.ts.
vi.mock('@/lib/google-sheets', () => ({
  readSheet: vi.fn(),
  getProduccionConfig: vi.fn(() => null),
}));
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }));
vi.mock('@/lib/supabase-controlpan', () => ({ getControlPanClient: vi.fn() }));
vi.mock('@/lib/auth-api', () => ({ requireAuth: vi.fn() }));

import { calcularVentasPorMes } from './route';

function order(overrides: Partial<{ created_at: string; total: number }>) {
  return { created_at: '2026-09-01T12:00:00.000Z', total: 1000, ...overrides };
}
function item(overrides: Partial<{ created_at: string; product_id: string; quantity: number; price: number }>) {
  return { created_at: '2026-09-01T12:00:00.000Z', product_id: 'pan', quantity: 1, price: 1000, ...overrides };
}

const productCategoryMap = { pan: 'Panadería', bebida: 'Bebidas y Aguas' };
const categoriasExcluidas = new Set(['Bebidas y Aguas']);

describe('calcularVentasPorMes', () => {
  test('el total de un mes no cambia según qué otros meses se incluyan en el array', () => {
    const ordersSept = [order({ created_at: '2026-09-05T10:00:00.000Z', total: 100000 })];
    const itemsSept = [
      item({ created_at: '2026-09-05T10:00:00.000Z', product_id: 'pan', quantity: 1, price: 80000 }),
      item({ created_at: '2026-09-05T10:00:00.000Z', product_id: 'bebida', quantity: 1, price: 20000 }),
    ];
    const soloSept = calcularVentasPorMes(ordersSept, itemsSept, productCategoryMap, categoriasExcluidas, {});

    const ordersAmplio = [
      ...ordersSept,
      order({ created_at: '2026-01-10T10:00:00.000Z', total: 5000000 }),
    ];
    const itemsAmplio = [
      ...itemsSept,
      item({ created_at: '2026-01-10T10:00:00.000Z', product_id: 'bebida', quantity: 1, price: 4000000 }),
    ];
    const rangoAmplio = calcularVentasPorMes(ordersAmplio, itemsAmplio, productCategoryMap, categoriasExcluidas, {});

    const sept1 = soloSept.find(v => v.key === '2026-09');
    const sept2 = rangoAmplio.find(v => v.key === '2026-09');
    expect(sept1?.ventas).toBe(80000); // 100000 - 20000 de bebidas, ambos de septiembre
    expect(sept2?.ventas).toBe(sept1?.ventas); // no debe cambiar por agregar enero al array
  });

  test('bebidas se restan del mes real del ítem, no del mes del pedido si difiriera', () => {
    const orders = [order({ created_at: '2026-09-01T00:00:00.000Z', total: 50000 })];
    const items = [
      item({ created_at: '2026-09-01T00:00:00.000Z', product_id: 'pan', quantity: 1, price: 30000 }),
      item({ created_at: '2026-10-01T00:00:00.000Z', product_id: 'bebida', quantity: 1, price: 20000 }),
    ];
    const resultado = calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, {});
    expect(resultado.find(v => v.key === '2026-09')?.ventas).toBe(50000); // sin bebidas que restar en sept
    // La bebida de octubre no genera un mes "2026-10" en ventasMesMap (no hay pedido ese mes),
    // así que se descarta silenciosamente: no aparece ni infla ningún mes.
    expect(resultado.find(v => v.key === '2026-10')).toBeUndefined();
  });

  test('pan externo se suma al mes correspondiente', () => {
    const orders = [order({ created_at: '2026-09-01T00:00:00.000Z', total: 50000 })];
    const items = [item({ created_at: '2026-09-01T00:00:00.000Z', product_id: 'pan', quantity: 1, price: 50000 })];
    const resultado = calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, { '2026-09': 10000 });
    expect(resultado.find(v => v.key === '2026-09')?.ventas).toBe(60000);
  });

  test('pedidos sin created_at válido se descartan', () => {
    const orders = [order({ created_at: '' }), order({ created_at: '2026-09-01T00:00:00.000Z', total: 1000 })];
    const resultado = calcularVentasPorMes(orders, [], productCategoryMap, categoriasExcluidas, {});
    expect(resultado).toHaveLength(1);
    expect(resultado[0].pedidos).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/produccion-data/route.test.ts`
Expected: FAIL — `calcularVentasPorMes` is not exported from `./route` yet.

- [ ] **Step 3: Extract and fix the function**

In `src/app/api/produccion-data/route.ts`, current lines 595-622 read:

```ts
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
```

Replace with:

```ts
    // ── Ventas por mes: (orders.total - bebidas del mes real) + pan externo del mes ──
    const panExternoPorMes = controlPan?.deudaPorMes ?? {};
    const ventasPorMes = calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, panExternoPorMes);
```

Then add the extracted, exported function near the top of the file, right after `esCategoriaDistribuidora` (after line 72, before the `// ── Rango de fechas ──` section):

```ts
/**
 * Ventas de Producción por mes: total de pedidos ConectOca del mes, menos las
 * bebidas/Distribuidora vendidas ese mismo mes, más pan externo del mes.
 *
 * Cada ítem resta su propio mes (created_at heredado del pedido padre en
 * fetchVentasSupabase) — a propósito NO se reparte proporcionalmente sobre un
 * total agregado, porque eso hacía que el resultado de un mes cambiara según
 * qué tan ancho fuera el rango de fechas consultado (un mismo septiembre daba
 * $25M consultado solo y $33M consultado junto con todo un año).
 */
export function calcularVentasPorMes(
  orders: Record<string, unknown>[],
  items: Record<string, unknown>[],
  productCategoryMap: Record<string, string>,
  categoriasExcluidas: Set<string>,
  panExternoPorMes: Record<string, number>,
): { key: string; mes: string; ventas: number; pedidos: number }[] {
  const ventasMesMap: Record<string, { ventas: number; pedidos: number }> = {};
  for (const o of orders) {
    const mes = String(o.created_at ?? '').slice(0, 7);
    if (!mes || mes.length !== 7) continue;
    if (!ventasMesMap[mes]) ventasMesMap[mes] = { ventas: 0, pedidos: 0 };
    ventasMesMap[mes].ventas  += Number(o.total ?? 0);
    ventasMesMap[mes].pedidos += 1;
  }
  const bebidasPorMes: Record<string, number> = {};
  for (const item of items) {
    const productId = String(item.product_id ?? '');
    const categoria = productCategoryMap[productId] ?? 'Sin área';
    if (!categoriasExcluidas.has(categoria)) continue;
    const mes = String(item.created_at ?? '').slice(0, 7);
    if (!mes || mes.length !== 7) continue;
    bebidasPorMes[mes] = (bebidasPorMes[mes] ?? 0) + Number(item.quantity ?? 0) * Number(item.price ?? 0);
  }
  return Object.entries(ventasMesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [anio, mes] = key.split('-');
      const ventasCorregidas = v.ventas - (bebidasPorMes[key] ?? 0) + (panExternoPorMes[key] ?? 0);
      return { key, mes: getMesLabel(parseInt(mes), parseInt(anio)), ventas: ventasCorregidas, pedidos: v.pedidos };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/produccion-data/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: all existing tests still PASS (no other file references the removed `bebidasRaw`/`totalOrdersSumLocal` names).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/produccion-data/route.ts src/app/api/produccion-data/route.test.ts
git commit -m "fix: ventas por mes de Producción ya no dependen del ancho del rango consultado"
```

---

### Task 3: Stop double-counting Distribuidora's gasto in the consolidated total (issue #2)

**Files:**
- Modify: `src/app/page.tsx:319` (inside `computed`)
- Modify: `src/app/page.tsx:415-418` (inside `computedDateRange`)

**Interfaces:** None — both edits are local to their respective `useMemo`s, no new exports.

**Why this is the only real double-count:** Distribuidora sells to the locales at cost (no markup). Whatever it buys from third parties to stock up is the exact same amount the locales later record as their own cost when they buy from it (proveedor "Distribuidora Oca" in each local's Facturas — `normalizeProveedorName`, `src/lib/data/parsers.ts:135`). Today `totalGastos` adds Facturas (which already contains that cost) **and** `distribuidoraGastosActivo` (the same cost, from Distribuidora's own sheet) on top — pure double-count, confirmed already fixed the same way in `src/app/api/informes/generate/route.ts:120-126` for the email report, just never ported to the dashboard.

- [ ] **Step 1: Fix `computed`**

In `src/app/page.tsx`, current line 319:
```ts
    if (!filtroActivo) totalGastos += produccionGastosActivo + distribuidoraGastosActivo;
```
Replace with:
```ts
    // Distribuidora vende a costo: lo que compra a terceros para abastecerse
    // no se suma acá — ya quedó anotado como gasto del local cuando este le
    // compró (proveedor "Distribuidora Oca" en sus Facturas, ver
    // normalizeProveedorName). Sumarlo de nuevo lo duplicaba.
    if (!filtroActivo) totalGastos += produccionGastosActivo;
```

- [ ] **Step 2: Fix `computedDateRange`**

In `src/app/page.tsx`, current lines 410-418:
```ts
    if (!filtroActivo && produccionSummary && (produccionSummary.ventas > 0 || produccionGastosActivo > 0)) {
      ventasPorLocal['Producción'] = produccionSummary.ventas;
      gastosPorSucursal['Producción'] = { gastos: produccionGastosActivo };
      totalGastos += produccionGastosActivo;
    }
    if (!filtroActivo && distribuidoraGastosActivo > 0) {
      gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastosActivo };
      totalGastos += distribuidoraGastosActivo;
    }
```
Replace with:
```ts
    if (!filtroActivo && produccionSummary && (produccionSummary.ventas > 0 || produccionGastosActivo > 0)) {
      ventasPorLocal['Producción'] = produccionSummary.ventas;
      gastosPorSucursal['Producción'] = { gastos: produccionGastosActivo };
      totalGastos += produccionGastosActivo;
    }
    // Distribuidora vende a costo: referencial, ya contado en el gasto del
    // local — no se suma al total (mismo criterio que en `computed`).
    if (!filtroActivo && distribuidoraGastosActivo > 0) {
      gastosPorSucursal['Distribuidora'] = { gastos: distribuidoraGastosActivo };
    }
```

- [ ] **Step 3: Manual verification in the browser**

Run: `npm run dev`, log in, open the dashboard for Septiembre 2026.
Expected:
- "Ventas Totales" stays at $196.403.282 — unchanged.
- "Gastos Totales" drops from $150.599.864 to approximately $130.969.082 (removing only the Distribuidora referencial gasto).
- "Margen Neto %" rises accordingly (from 23,3% to roughly 33%).
- Treemap/resumen por sucursal still shows "Distribuidora" with its gasto (referencial) — unaffected by this change, it was never removed from `gastosPorSucursal`.
- Switch to "rango de fechas" mode and pick a September range — same kind of drop, consistent with month mode.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: Gastos Totales ya no duplica el gasto referencial de Distribuidora"
```

---

### Task 4: Make the "Ventas vs Gastos — Por Mes" chart match the KPI cards (issue #1)

**Files:**
- Modify: `src/app/page.tsx:71-73` (new state)
- Modify: `src/app/page.tsx:332-341` (`realChartData` inside `computed`)
- Modify: `src/app/page.tsx:370` (`computed`'s dependency array)
- Modify: `src/app/page.tsx:515-542` (extend the existing wide-range Producción fetch)

**Interfaces:**
- Consumes: `/api/produccion-data` response fields `ventasPorMes: { key, ventas }[]` (now stable after Task 2) and `gastosPorMes: { key, monto }[]` (Producción's own costs per month — already stable, unrelated to Task 2's bug).

**Design:** The chart must sum Producción exactly like the KPI cards do — full monthly ventas (no exclusion, per the Task 3 analysis: Producción's intercompany sale cancels naturally against the matching cost already inside the locales' Facturas) and Producción's own monthly gastos (never duplicated). Distribuidora stays excluded from the chart too, consistent with Task 3 (referencial only). This task depends on Task 2: the chart fetches `ventasPorMes` over the *entire* historical range in one call, which is exactly the scenario that used to give wrong per-month figures.

- [ ] **Step 1: Add state for Producción's historical monthly gastos**

In `src/app/page.tsx`, current lines 71-73:
```ts
  // Serie histórica de ventas de Producción, para cuando se la elige en "comparar por
  // sucursal". Aparte de produccionSummary porque ese solo cubre el período filtrado.
  const [produccionPorMes, setProduccionPorMes] = useState<Record<string, number>>({});
```
Replace with:
```ts
  // Series históricas de Producción (todos los meses, no solo el filtrado):
  // ventas por mes (ya se usaba para "comparar por sucursal"; ahora también
  // alimenta el gráfico "Ventas vs Gastos — Por Mes") y su gasto propio por
  // mes (nuevo, mismo gráfico).
  const [produccionPorMes, setProduccionPorMes] = useState<Record<string, number>>({});
  const [produccionGastosPorMesHistorico, setProduccionGastosPorMesHistorico] = useState<Record<string, number>>({});
```

- [ ] **Step 2: Fetch the historical series unconditionally (not just when comparing by sucursal)**

In `src/app/page.tsx`, current lines 515-542:
```ts
  // Ventas de Producción por mes, solo cuando se la elige para comparar: al no
  // salir de Cierre de Caja, "Distribución por Sucursal" no puede alimentar su
  // línea del gráfico con porLocalMes como al resto de las sucursales.
  useEffect(() => {
    if (!selectedSucursales.includes('Producción')) return;
    if (!ccData?.mesesDisponibles?.length) return;
    if (Object.keys(produccionPorMes).length > 0) return; // ya se trajo

    const meses = [...ccData.mesesDisponibles].sort();
    const params = new URLSearchParams({
      local: 'todos',
      mesDesde: meses[0],
      mesHasta: meses[meses.length - 1],
    });

    let cancelled = false;
    fetch(`/api/produccion-data?${params}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d?.ok) return;
        const map: Record<string, number> = {};
        for (const item of d.ventasPorMes ?? []) map[item.key] = item.ventas ?? 0;
        setProduccionPorMes(map);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedSucursales, ccData, produccionPorMes]);
```

Replace with:
```ts
  // Series históricas de Producción por mes — se traen una sola vez que haya
  // meses disponibles (no solo cuando se elige "comparar por sucursal"),
  // porque el gráfico "Ventas vs Gastos — Por Mes" las necesita siempre.
  useEffect(() => {
    if (!ccData?.mesesDisponibles?.length) return;
    if (Object.keys(produccionPorMes).length > 0) return; // ya se trajo

    const meses = [...ccData.mesesDisponibles].sort();
    const params = new URLSearchParams({
      local: 'todos',
      mesDesde: meses[0],
      mesHasta: meses[meses.length - 1],
    });

    let cancelled = false;
    fetch(`/api/produccion-data?${params}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d?.ok) return;
        const ventas: Record<string, number> = {};
        for (const item of d.ventasPorMes ?? []) ventas[item.key] = item.ventas ?? 0;
        setProduccionPorMes(ventas);

        const gastos: Record<string, number> = {};
        for (const item of d.gastosPorMes ?? []) gastos[item.key] = item.monto ?? 0;
        setProduccionGastosPorMesHistorico(gastos);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [ccData, produccionPorMes]);
```

- [ ] **Step 3: Add Producción's ventas and gastos to `realChartData`**

In `src/app/page.tsx`, current lines 332-341 (inside `computed`):
```ts
    const realChartData = mesesDisponibles.map((key, i) => {
      const mes = parseInt(key.split('-')[1], 10);
      const ventas = !filtroActivo
        ? (chartData[i]?.ventas ?? 0)
        : sucursales.reduce((s, suc) => s + (porLocalMes[suc]?.[key]?.ventas ?? 0), 0);
      const gastos = !filtroActivo
        ? (gastosPorMes[key] ?? 0)
        : sucursales.reduce((s, suc) => s + (gastosPorMesSucursal[suc]?.[key] ?? 0), 0);
      return { dia: MESES_SHORT[mes] + ' ' + key.split('-')[0], ventas, gastos };
    });
```

Replace with:
```ts
    const realChartData = mesesDisponibles.map((key, i) => {
      const mes = parseInt(key.split('-')[1], 10);
      let ventas = !filtroActivo
        ? (chartData[i]?.ventas ?? 0)
        : sucursales.reduce((s, suc) => s + (porLocalMes[suc]?.[key]?.ventas ?? 0), 0);
      let gastos = !filtroActivo
        ? (gastosPorMes[key] ?? 0)
        : sucursales.reduce((s, suc) => s + (gastosPorMesSucursal[suc]?.[key] ?? 0), 0);
      if (!filtroActivo) {
        // Mismo criterio que la tarjeta KPI (ver Task 3): venta COMPLETA de
        // Producción (no se excluye nada, se cancela sola con el costo que
        // el local ya anotó) y su gasto propio, mes a mes. Distribuidora
        // queda afuera, solo referencial.
        ventas += produccionPorMes[key] ?? 0;
        gastos += produccionGastosPorMesHistorico[key] ?? 0;
      }
      return { dia: MESES_SHORT[mes] + ' ' + key.split('-')[0], ventas, gastos };
    });
```

- [ ] **Step 4: Add the new state map to `computed`'s dependency array**

In `src/app/page.tsx`, current `computed`'s closing dependency array (line 370):
```ts
  }, [ccData, vData, filters.sucursales, mesFiltro, modoFiltro, modoGastos, produccionSummary, distribuidoraGastos, totalSucursales]);
```
Replace with:
```ts
  }, [ccData, vData, filters.sucursales, mesFiltro, modoFiltro, modoGastos, produccionSummary, distribuidoraGastos, totalSucursales, produccionPorMes, produccionGastosPorMesHistorico]);
```

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, open the dashboard, hover the September 2026 bar in "Ventas vs Gastos — Por Mes".
Expected: the tooltip's Ventas/Gastos for Sep 2026 now read $196.403.282 / $130.969.082 — matching the KPI cards exactly (Ventas unchanged, Gastos reflecting Task 3's fix). This is the original bug report, now resolved end to end. Also check Oct 2026 (partial month) and an older month (e.g. Mar 2026) still render sensibly — no NaN, no negative bars.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix: el gráfico mensual suma Producción igual que las tarjetas KPI"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 → issue #5. Task 2 → issue #4. Task 3 → issue #2 (the only confirmed real double-count). Task 4 → issue #1, depends on Task 2 (stability) and matches Task 3's now-unchanged-Ventas / now-fixed-Gastos. Issue #3 (originally diagnosed as "Producción ventas double-counted") is **not** fixed — per the math check with the user, it was never actually a bug when left alone; it only became one when half-fixed. No code change needed for it.
- **Type consistency:** `calcularVentasPorMes`'s signature in Task 2 matches the `orders`/`items`/`productCategoryMap`/`categoriasExcluidas` types already in scope in `produccion-data/route.ts`'s `GET` handler. Task 4's `produccionGastosPorMesHistorico` state name is used identically in its declaration, the fetch effect, and `realChartData`.
- **No placeholders:** every step has the literal before/after code, not a description of it.

## Known Limitations (found during Task 4's review, not fixed in this branch)

- ~~`calcularVentasPorMes` (src/app/api/produccion-data/route.ts) buckets each order by `String(o.created_at ?? '').slice(0, 7)` — the order's raw UTC calendar month — not its Chile-local calendar month.~~ **RESOLVED** in a follow-up (commit `c3b393d`, branch `worktree-fix-timezone-ventas-por-mes`): added `mesLocalDesdeInstante` to `date-utils.ts` and used it in `calcularVentasPorMes` and the `?soloMeses=1` endpoint. That same follow-up also found and fixed a second, larger-impact bug that was compounding the same symptom: `fetchControlPan` never paginated its `salidas`/`pagos` queries, so a wide date range (the 12 months the chart fetches) silently lost rows past PostgREST's 1000-row default cap — September's "pan externo" was entirely missing, August partial. Both fixes together close the gap exactly: the chart's September 2026 bar now reads identically to the KPI cards ($198.521.079 / $131.087.060).
