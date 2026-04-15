/**
 * session-client.ts
 * Utilidad CLIENT-SIDE para leer la sesión desde la cookie.
 * Solo usar en componentes 'use client'.
 */

export interface ClientSession {
  username: string;
  role: 'admin' | 'usuario' | 'local';
  email?: string;
  sucursal?: string; // definido cuando role === 'local'
}

export function getClientSession(): ClientSession | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').find(c => c.trim().startsWith('session='));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
  } catch {
    return null;
  }
}

/** Devuelve el local asignado si el usuario tiene rol 'local', o null si puede ver todos. */
export function getLocalRestriction(): string | null {
  const s = getClientSession();
  if (!s || s.role !== 'local') return null;
  return s.sucursal ?? null;
}
