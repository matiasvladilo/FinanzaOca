import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_UI_COOKIE } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(SESSION_UI_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}
