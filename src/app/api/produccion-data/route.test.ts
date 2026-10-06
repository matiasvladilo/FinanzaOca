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
