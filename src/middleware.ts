import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'session';
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir rutas públicas
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Verificar cookie de sesión
  const session = req.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const parsed = JSON.parse(session);
    if (!parsed.username || !parsed.role) throw new Error('invalid');

    // Rol 'local': solo puede acceder a /ventas y sus APIs
    if (parsed.role === 'local') {
      const isAllowed =
        pathname.startsWith('/ventas') ||
        pathname.startsWith('/api/ventas') ||
        pathname.startsWith('/api/cierre-caja') ||
        pathname.startsWith('/api/presupuesto');
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/ventas', req.url));
      }
    }

    return NextResponse.next();
  } catch {
    // Cookie inválida → limpiar y redirigir
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
    return res;
  }
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto assets estáticos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)',
  ],
};
