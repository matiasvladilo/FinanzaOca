/**
 * Netlify Scheduled Function — Informe Semanal
 *
 * Corre todos los martes a las 09:00 hora Chile (12:00 UTC).
 * Reporta los últimos 7 días completos (hasta ayer inclusive) — no omite
 * fin de semana ni el lunes.
 *
 * Respeta el interruptor de /api/informes/settings: si el semanal está
 * desactivado, /api/informes/cron devuelve ok sin mandar nada.
 *
 * Vars requeridas en Netlify Dashboard:
 *   CRON_SECRET, NEXT_PUBLIC_BASE_URL
 */

export const config = {
  schedule: '0 12 * * 2', // 09:00 CLT (UTC-3) los martes
};

export default async (_req: Request): Promise<Response> => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const secret  = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    console.error('[report-weekly] Faltan variables de entorno: NEXT_PUBLIC_BASE_URL o CRON_SECRET');
    return new Response('Missing env vars', { status: 500 });
  }

  const url = `${baseUrl}/api/informes/cron?type=weekly&secret=${encodeURIComponent(secret)}`;
  console.log(`[report-weekly] Disparando informe semanal → ${url}`);

  try {
    const res  = await fetch(url, { method: 'GET' });
    const body = await res.json() as Record<string, unknown>;

    if (body.ok) {
      console.log('[report-weekly] Informe enviado correctamente', body);
      return new Response('weekly report sent', { status: 200 });
    } else {
      console.error('[report-weekly] Error en el informe', body);
      return new Response(`Error: ${String(body.error ?? 'unknown')}`, { status: 500 });
    }
  } catch (err) {
    console.error('[report-weekly] Error de red:', err);
    return new Response('Network error', { status: 500 });
  }
};
