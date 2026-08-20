import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_UI_COOKIE } from '@/lib/session-cookies';
import { verifySession } from '@/lib/session';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

/** Redirige a /login limpiando las dos cookies de sesión. */
function toLogin(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(SESSION_UI_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // La sesión se resuelve verificando la firma: una cookie editada a mano no
  // pasa de acá. Vencida también cae, porque la caducidad va firmada dentro.
  const user = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return toLogin(req);

  // Rol 'local': solo puede acceder a /ventas y sus APIs
  if (user.role === 'local') {
    const isAllowed =
      pathname.startsWith('/ventas') ||
      pathname.startsWith('/api/ventas') ||
      pathname.startsWith('/api/cierre-caja') ||
      pathname.startsWith('/api/presupuesto');
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/ventas', req.url));
    }
  }

  // Rol 'produccion': solo puede acceder a /produccion (que ahora incluye la
  // solapa Productos). /productos se mantiene permitido porque sigue existiendo
  // como redirect para los links viejos.
  if (user.role === 'produccion') {
    const isAllowed =
      pathname.startsWith('/productos') ||
      pathname.startsWith('/produccion') ||
      pathname.startsWith('/api/produccion') ||
      pathname.startsWith('/api/produccion-data');
    if (!isAllowed) {
      return NextResponse.redirect(new URL('/produccion', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)',
  ],
};
