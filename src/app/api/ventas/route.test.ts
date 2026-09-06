import { describe, expect, test, vi } from 'vitest';

// route.ts importa '@/lib/google-sheets', que hace `import 'server-only'` —
// ese paquete tira siempre bajo vitest (no hay bundler de Next.js que lo
// resuelva a la variante no-op). Se mockea acá, igual que
// src/app/api/asistente/chat/route.test.ts mockea sus propias dependencias
// de servidor, para poder importar `agregarGastos`/`RegistroFactura` de
// route.ts sin ejecutar código real de Google Sheets.
vi.mock('@/lib/google-sheets', () => ({
  readSheet: vi.fn(),
  getLocalesConfig: vi.fn(() => []),
}));

import { agregarGastos, type RegistroFactura } from './route';

function factura(overrides: Partial<RegistroFactura>): RegistroFactura {
  return {
    id: 1, sucursal: 'PV', tipo: 'GASTO', subtipo: '',
    proveedor: 'Proveedor Test', medioPago: 'Transferencia',
    monto: 1000, fecha: '2026-09-01', mes: 9, anio: 2026,
    ...overrides,
  };
}

describe('agregarGastos', () => {
  test('suma totalGastos y totalIngresos sobre el array recibido', () => {
    const gastos = [
      factura({ monto: 1000, tipo: 'GASTO' }),
      factura({ monto: 500, tipo: 'INGRESO' }),
    ];
    const r = agregarGastos(gastos, 2, 2026);
    expect(r.kpi.totalGastos).toBe(1500); // GASTO+INGRESO, ver comentario en route.ts
    expect(r.kpi.totalIngresos).toBe(500);
    expect(r.kpi.totalTransacciones).toBe(2);
  });

  test('hastaHoy excluye fechas futuras y finDeMes las incluye — mismo helper, arrays distintos', () => {
    const hoyISO = '2026-09-15';
    const todas = [
      factura({ monto: 1000, fecha: '2026-09-01', mes: 9, anio: 2026 }),
      factura({ monto: 2000, fecha: '2026-09-28', mes: 9, anio: 2026 }), // futuro respecto a hoyISO
    ];
    const hastaHoy = agregarGastos(todas.filter(r => r.fecha <= hoyISO), todas.length, 2026);
    const finDeMes = agregarGastos(todas, todas.length, 2026);
    expect(hastaHoy.kpi.totalGastos).toBe(1000);
    expect(finDeMes.kpi.totalGastos).toBe(3000);
  });

  test('sin fechas futuras, ambas vistas coinciden (mes cerrado)', () => {
    const hoyISO = '2026-09-30';
    const todas = [
      factura({ monto: 1000, fecha: '2026-08-05', mes: 8, anio: 2026 }),
      factura({ monto: 2000, fecha: '2026-08-20', mes: 8, anio: 2026 }),
    ];
    const hastaHoy = agregarGastos(todas.filter(r => r.fecha <= hoyISO), todas.length, 2026);
    const finDeMes = agregarGastos(todas, todas.length, 2026);
    expect(hastaHoy.kpi.totalGastos).toBe(finDeMes.kpi.totalGastos);
    expect(hastaHoy.gastosPorMes).toEqual(finDeMes.gastosPorMes);
  });

  test('gastosPorMes y porSucursal se calculan sobre el array recibido', () => {
    const gastos = [
      factura({ sucursal: 'PV', monto: 100, mes: 9, anio: 2026 }),
      factura({ sucursal: 'Bilbao', monto: 200, mes: 9, anio: 2026 }),
    ];
    const r = agregarGastos(gastos, 2, 2026);
    expect(r.gastosPorMes['2026-09']).toBe(300);
    expect(r.porSucursal['PV'].gastos).toBe(100);
    expect(r.porSucursal['Bilbao'].gastos).toBe(200);
  });

  test('descarta años futuros de gastosPorMes (mismo guard que hoy)', () => {
    const gastos = [factura({ monto: 999, mes: 1, anio: 2099 })];
    const r = agregarGastos(gastos, 1, 2026);
    expect(r.gastosPorMes['2099-01']).toBeUndefined();
  });
});
