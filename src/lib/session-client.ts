/**
 * session-client.ts
 * Utilidad CLIENT-SIDE para leer la sesión desde la cookie.
 * Solo usar en componentes 'use client'.
 *
 * OJO: lee `session_ui`, que existe solo para pintar la interfaz. La cookie de
 * sesión real (`session`) es httpOnly y firmada, y desde acá no se puede leer.
 * Todo lo que salga de este módulo es una pista para la UI, nunca una decisión
 * de seguridad: quién puede ver qué lo deciden el middleware y las rutas API
 * verificando la firma. Editar `session_ui` a mano no da acceso a nada.
 */

import { SESSION_UI_COOKIE } from '@/lib/session-cookies';

export interface ClientSession {
  username: string;
  role: 'admin' | 'usuario' | 'local' | 'produccion';
  email?: string;
  sucursal?: string; // definido cuando role === 'local'
}

export function getClientSession(): ClientSession | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${SESSION_UI_COOKIE}=`;
  const match = document.cookie.split(';').find(c => c.trim().startsWith(prefix));
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
