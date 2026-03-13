/**
 * cache.ts
 * Caché en memoria con TTL para reducir llamadas a Google Sheets.
 *
 * TTL por defecto: 5 minutos.
 * En producción (Netlify) el servidor puede reiniciarse entre requests,
 * pero en dev y durante el SSR el caché evita llamadas duplicadas.
 *
 * SOLO usar en server-side (route handlers, server components).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Map global — persiste entre requests en el mismo proceso Node.js
const store = new Map<string, CacheEntry<unknown>>();

/** TTL por defecto: 5 minutos */
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Recupera un valor del caché.
 * Retorna null si no existe o si expiró.
 */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Guarda un valor en el caché con TTL opcional.
 * @param key     Clave única (ej: "cierre-caja", "ventas:2025-03")
 * @param data    Dato a cachear
 * @param ttlMs   Tiempo de vida en ms (default: DEFAULT_TTL_MS)
 */
export function setCached<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalida una clave específica del caché.
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Limpia todo el caché (útil en testing o forzar refresco).
 */
export function clearCache(): void {
  store.clear();
}

/**
 * Helper: intenta obtener del caché; si no, ejecuta el fetcher y cachea el resultado.
 *
 * Uso:
 *   const data = await withCache('cierre-caja', () => fetchFromSheets());
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  setCached(key, data, ttlMs);
  return data;
}
