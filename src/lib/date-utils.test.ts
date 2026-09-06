import { describe, expect, test, vi } from 'vitest';
import { esMesActualChile } from './date-utils';

describe('esMesActualChile', () => {
  test('devuelve true para el mes y año actuales (hora de Chile)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z')); // mediodía UTC = mañana en Chile
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
