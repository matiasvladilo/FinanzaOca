/**
 * GET  /api/user/profile  → devuelve el email guardado del usuario actual en Supabase
 * PATCH /api/user/profile → guarda/actualiza el email del usuario en Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';

const SUPABASE_URL = process.env.USER_PROFILES_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.USER_PROFILES_SUPABASE_KEY ?? '';

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?username=eq.${encodeURIComponent(user.username)}&select=username,email&limit=1`,
      { headers: HEADERS },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: 500 });
    }

    const rows = (await res.json()) as Array<{ username: string; email: string }>;
    return NextResponse.json({ ok: true, username: user.username, email: rows[0]?.email ?? '' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const { email } = (await req.json()) as { email: string };
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: false, error: 'Se requiere un email válido' }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ username: user.username, email: email.trim(), updated_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
