import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SessionUser, getPermissions } from '@/lib/auth';
import { verifySession } from '@/lib/session';

// Leer la sesión desde la cookie (server-side, dentro de API routes).
// Es async porque verificar la firma HMAC lo es.
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

// Usar en API routes: devuelve el usuario o una respuesta 401 lista para retornar
export async function requireAuth(
  req: NextRequest,
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSessionUser(req);
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
