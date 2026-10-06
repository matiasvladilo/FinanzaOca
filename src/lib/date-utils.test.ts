import { describe, expect, test, vi } from 'vitest';
import { esMesActualChile, esMesFuturoChile, mesLocalDesdeInstante } from './date-utils';

describe('esMesActualChile', () => {
  test('devuelve true para el mes y año actuales (hora de Chile)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z')); // mediodía UTC = 08:00 en Chile (UTC-4), sigue siendo 15/set
    expect(esMesActualChile('2026-09')).toBe(true);
    vi.useRealTimers();
  });

  test('devuelve false para un mes pasado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesActualChile('2026-08')).toBe(false);
    vi.useRealTimers();
  });

  test('devuelve false para un mes futuro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesActualChile('2026-10')).toBe(false);
    vi.useRealTimers();
  });
});

describe('esMesFuturoChile', () => {
  test('devuelve true para un mes futuro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesFuturoChile('2026-10')).toBe(true);
    vi.useRealTimers();
  });

  test('devuelve false para el mes actual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesFuturoChile('2026-09')).toBe(false);
    vi.useRealTimers();
  });

  test('devuelve false para un mes pasado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    expect(esMesFuturoChile('2026-08')).toBe(false);
    vi.useRealTimers();
  });
});

describe('mesLocalDesdeInstante', () => {
  test('el primer instante de septiembre en Chile da "2026-09"', () => {
    // 2026-09-01T04:00:00.000Z = 2026-09-01 00:00:00 en Chile (UTC-4 en esa fecha,
    // mismo límite que limitesUtcDelRango('2026-09-01','2026-09-30').desdeISO)
    expect(mesLocalDesdeInstante('2026-09-01T04:00:00.000Z')).toBe('2026-09');
  });

  test('el último instante de septiembre en Chile sigue dando "2026-09" aunque ya sea octubre en UTC', () => {
    // 2026-10-01T02:59:59.999Z = 2026-09-30 23:59:59.999 en Chile (UTC-3 tras el
    // cambio de horario) — este es exactamente el caso que agrupaba mal antes:
    // .slice(0,7) sobre el string UTC da "2026-10", pero el pedido es de septiembre.
    expect(mesLocalDesdeInstante('2026-10-01T02:59:59.999Z')).toBe('2026-09');
  });

  test('el primer instante de octubre en Chile da "2026-10"', () => {
    // 2026-10-01T03:00:00.000Z = 2026-10-01 00:00:00 en Chile
    expect(mesLocalDesdeInstante('2026-10-01T03:00:00.000Z')).toBe('2026-10');
  });

  test('input inválido o vacío devuelve string vacío', () => {
    expect(mesLocalDesdeInstante('')).toBe('');
    expect(mesLocalDesdeInstante('no-es-una-fecha')).toBe('');
  });
});
