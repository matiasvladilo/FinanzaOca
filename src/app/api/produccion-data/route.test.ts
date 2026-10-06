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

import { calcularVentasPorMes, fetchControlPan } from './route';
import { getControlPanClient } from '@/lib/supabase-controlpan';

// Simula el query builder de Supabase: thenable en cada paso de la cadena,
// igual que el real. Sin .range() explícito, PostgREST igual corta en 1000
// filas por defecto — por eso el mock también trunca a eso cuando .range()
// nunca se llamó, para poder reproducir la pérdida de filas del bug real.
function makeTableMock(rows: Array<Record<string, unknown>>) {
  let rango: [number, number] | null = null;
  const builder: Record<string, unknown> = {
    select: () => builder,
    gte: () => builder,
    lte: () => builder,
    eq: () => builder,
    order: () => builder,
    range: (from: number, to: number) => { rango = [from, to]; return builder; },
    then: (resolve: (v: { data: unknown[]; error: null }) => void) => {
      const [from, to] = rango ?? [0, 999];
      resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  return builder;
}

function makeControlPanClientMock(tablas: Record<string, Array<Record<string, unknown>>>) {
  return { from: (tabla: string) => makeTableMock(tablas[tabla] ?? []) } as unknown as ReturnType<typeof getControlPanClient>;
}

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
    // Horarios de mediodía UTC a propósito (no medianoche exacta): a
    // medianoche UTC, con el offset de Chile (-3/-4), la fecha local cae en
    // el día anterior — mediodía UTC siempre mapea al mismo día en Chile.
    const orders = [order({ created_at: '2026-09-15T15:00:00.000Z', total: 50000 })];
    const items = [
      item({ created_at: '2026-09-15T15:00:00.000Z', product_id: 'pan', quantity: 1, price: 30000 }),
      item({ created_at: '2026-10-15T15:00:00.000Z', product_id: 'bebida', quantity: 1, price: 20000 }),
    ];
    const resultado = calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, {});
    expect(resultado.find(v => v.key === '2026-09')?.ventas).toBe(50000); // sin bebidas que restar en sept
    // La bebida de octubre no genera un mes "2026-10" en ventasMesMap (no hay pedido ese mes),
    // así que se descarta silenciosamente: no aparece ni infla ningún mes.
    expect(resultado.find(v => v.key === '2026-10')).toBeUndefined();
  });

  test('pan externo se suma al mes correspondiente', () => {
    const orders = [order({ created_at: '2026-09-15T15:00:00.000Z', total: 50000 })];
    const items = [item({ created_at: '2026-09-15T15:00:00.000Z', product_id: 'pan', quantity: 1, price: 50000 })];
    const resultado = calcularVentasPorMes(orders, items, productCategoryMap, categoriasExcluidas, { '2026-09': 10000 });
    expect(resultado.find(v => v.key === '2026-09')?.ventas).toBe(60000);
  });

  test('pedidos sin created_at válido se descartan', () => {
    const orders = [order({ created_at: '' }), order({ created_at: '2026-09-01T00:00:00.000Z', total: 1000 })];
    const resultado = calcularVentasPorMes(orders, [], productCategoryMap, categoriasExcluidas, {});
    expect(resultado).toHaveLength(1);
    expect(resultado[0].pedidos).toBe(1);
  });

  test('un pedido de último día de mes en Chile se agrupa en ese mes aunque su created_at UTC ya sea el mes siguiente', () => {
    // 2026-10-01T02:59:59.999Z = 2026-09-30 23:59:59.999 en Chile (UTC-3 en esa
    // fecha) — el caso real que se perdía: .slice(0,7) sobre el string UTC daba
    // "2026-10", pero el pedido es de septiembre.
    const orders = [
      order({ created_at: '2026-09-05T10:00:00.000Z', total: 100000 }),
      order({ created_at: '2026-10-01T02:59:59.999Z', total: 50000 }),
    ];
    const resultado = calcularVentasPorMes(orders, [], productCategoryMap, categoriasExcluidas, {});
    expect(resultado.find(v => v.key === '2026-09')?.ventas).toBe(150000);
    expect(resultado.find(v => v.key === '2026-09')?.pedidos).toBe(2);
    expect(resultado.find(v => v.key === '2026-10')).toBeUndefined();
  });
});

describe('fetchControlPan', () => {
  test('suma las 1200 filas de "salidas" sin perder las que exceden la página de 1000 de PostgREST', async () => {
    const salidas = Array.from({ length: 1200 }, (_, i) => ({
      local: 'CLINICA', kg: 1, deuda: 1000, fecha: '2026-09-15', id: i,
    }));
    vi.mocked(getControlPanClient).mockReturnValue(makeControlPanClientMock({ salidas, pagos: [], locales: [] }));

    const resultado = await fetchControlPan(new Date(2025, 10, 1), new Date(2026, 9, 31));

    expect(resultado?.kpi.totalDeudaGenerada).toBe(1200 * 1000);
    expect(resultado?.deudaPorMes['2026-09']).toBe(1200 * 1000);
  });

  test('suma los pagos de más de 1000 filas igual que las salidas', async () => {
    const pagos = Array.from({ length: 1500 }, (_, i) => ({ local: 'CLINICA', monto: 100, fecha: '2026-09-15', id: i }));
    vi.mocked(getControlPanClient).mockReturnValue(makeControlPanClientMock({ salidas: [], pagos, locales: [] }));

    const resultado = await fetchControlPan(new Date(2025, 10, 1), new Date(2026, 9, 31));

    expect(resultado?.kpi.totalPagado).toBe(1500 * 100);
  });
});
