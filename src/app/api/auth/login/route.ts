import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials, SESSION_COOKIE, SESSION_UI_COOKIE, SessionUser } from '@/lib/auth';
import { signSession, SESSION_TTL_SECONDS } from '@/lib/session';

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

    const session: SessionUser = { username: user.username, role: user.role, email: user.email, sucursal: user.sucursal };

    const token = await signSession(session);
    if (!token) {
      console.error('[auth/login] SESSION_SECRET no está configurada (mínimo 32 caracteres)');
      return NextResponse.json(
        { message: 'El servidor no está configurado para iniciar sesión' },
        { status: 500 },
      );
    }

    const secure = process.env.NODE_ENV === 'production';
    const res = NextResponse.json({ ok: true });

    // Credencial real: firmada y fuera del alcance de JavaScript.
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    });

    // Copia legible solo para la interfaz. El server no la lee nunca.
    res.cookies.set(SESSION_UI_COOKIE, JSON.stringify(session), {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      maxAge: SESSION_TTL_SECONDS,
      path: '/',
    });

    return res;
  } catch {
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
