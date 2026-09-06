import { describe, expect, test, vi } from 'vitest';
import { esMesActualChile } from './date-utils';

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
