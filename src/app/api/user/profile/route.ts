/**
 * GET  /api/user/profile  → devuelve el email del usuario actual
 *   1. Si Supabase está configurado y el usuario tiene email guardado → lo devuelve
 *   2. Si no → usa el email hardcodeado en auth.ts como fallback
 * PATCH /api/user/profile → guarda/actualiza el email del usuario en Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { findUser } from '@/lib/auth';

function getSupabaseConfig() {
  const url = process.env.USER_PROFILES_SUPABASE_URL;
  const key = process.env.USER_PROFILES_SUPABASE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  // Fallback: email hardcodeado en auth.ts
  const hardcodedUser = findUser(user.username);
  const fallbackEmail = hardcodedUser?.email ?? '';

  // Intentar obtener email personalizado desde Supabase
  const supabase = getSupabaseConfig();
  if (supabase) {
    try {
      const res = await fetch(
        `${supabase.url}/rest/v1/user_profiles?username=eq.${encodeURIComponent(user.username)}&select=username,email&limit=1`,
        { headers: { apikey: supabase.key, Authorization: `Bearer ${supabase.key}` } },
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{ username: string; email: string }>;
        const savedEmail = rows[0]?.email;
        if (savedEmail) {
          return NextResponse.json({ ok: true, username: user.username, email: savedEmail });
        }
      }
    } catch {
      // Supabase falló — usar fallback
    }
  }

  return NextResponse.json({ ok: true, username: user.username, email: fallbackEmail });
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

    const { url, key } = getSupabaseConfig();
    const res = await fetch(`${url}/rest/v1/user_profiles`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
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
