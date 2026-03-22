import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SessionUser, getPermissions } from '@/lib/auth';

// Leer la sesión desde la cookie (server-side, dentro de API routes)
export function getSessionUser(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(cookie) as SessionUser;
    if (!parsed.username || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Usar en API routes: devuelve el usuario o una respuesta 401 lista para retornar
export function requireAuth(
  req: NextRequest,
): { user: SessionUser } | NextResponse {
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }
  return { user };
}

// Verificar si un usuario tiene acceso a una ubicación específica
export function canAccessLocation(user: SessionUser, location: string): boolean {
  const perms = getPermissions(user.role);
  return perms.canViewAll || perms.allowedLocations.includes(location);
}
