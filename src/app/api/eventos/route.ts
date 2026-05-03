import { NextRequest, NextResponse } from 'next/server';
import { fetchEventosSantiago } from '@/lib/predicthq';
import { withCacheSWR } from '@/lib/data/cache';

const TTL_24H = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()));
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ ok: false, error: 'Parámetros inválidos' }, { status: 400 });
  }

  const cacheKey = `eventos-${year}-${String(month).padStart(2, '0')}`;

  try {
    const eventos = await withCacheSWR(cacheKey, () => fetchEventosSantiago(year, month), TTL_24H);
    return NextResponse.json({ ok: true, eventos });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
