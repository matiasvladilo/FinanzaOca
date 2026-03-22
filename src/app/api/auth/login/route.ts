import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, SESSION_COOKIE, SessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const user = validateCredentials(username, password);

    if (!user) {
      return NextResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 });
    }

    const session: SessionUser = { username: user.username, role: user.role };

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, JSON.stringify(session), {
      httpOnly: false, // debe ser legible por el cliente para mostrar datos del usuario
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    });
    return res;
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
