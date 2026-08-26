/**
 * GET/POST /api/informes/settings
 * Interruptor real de encendido/apagado para los informes automáticos
 * (semanal y mensual). Solo admin. El cron (`/api/informes/cron`) lee este
 * mismo store antes de generar y mandar cada informe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-api';
import { getReportSettings, setReportSettings } from '@/lib/report-settings';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }

  const settings = await getReportSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
  }

  try {
    const body = await req.json();
    // Acepta un objeto parcial, pero el cliente (AutomationPanel) siempre
    // manda los dos campos juntos — evita que dos toggles casi simultáneos
    // se pisen entre sí en el lectura-mezcla-escritura de setReportSettings.
    const patch: Record<string, boolean> = {};
    if (typeof body?.weeklyEnabled === 'boolean') patch.weeklyEnabled = body.weeklyEnabled;
    if (typeof body?.monthlyEnabled === 'boolean') patch.monthlyEnabled = body.monthlyEnabled;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nada para actualizar (weeklyEnabled/monthlyEnabled)' }, { status: 400 });
    }

    const settings = await setReportSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error('[informes/settings] Error guardando configuración:', err);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración' }, { status: 500 });
  }
}
