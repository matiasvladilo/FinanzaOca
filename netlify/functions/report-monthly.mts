/**
 * Netlify Scheduled Function — Informe Mensual
 *
 * Corre el día 1 de cada mes a las 09:00 hora Chile (12:00 UTC).
 * Reporta el mes anterior completo (primer al último día).
 *
 * Vars requeridas en Netlify Dashboard:
 *   CRON_SECRET, NEXT_PUBLIC_BASE_URL
 */

export const config = {
  schedule: '0 12 1 * *', // 09:00 CLT (UTC-3) el 1° de cada mes
};

export default async (_req: Request): Promise<Response> => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const secret  = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    console.error('[report-monthly] Faltan variables de entorno: NEXT_PUBLIC_BASE_URL o CRON_SECRET');
    return new Response('Missing env vars', { status: 500 });
  }

  const url = `${baseUrl}/api/informes/cron?type=monthly&secret=${encodeURIComponent(secret)}`;
  console.log(`[report-monthly] Disparando informe mensual → ${url}`);

  try {
    const res  = await fetch(url, { method: 'GET' });
    const body = await res.json() as Record<string, unknown>;

    if (body.ok) {
      console.log('[report-monthly] Informe enviado correctamente', body);
      return new Response('monthly report sent', { status: 200 });
    } else {
      console.error('[report-monthly] Error en el informe', body);
      return new Response(`Error: ${String(body.error ?? 'unknown')}`, { status: 500 });
    }
  } catch (err) {
    console.error('[report-monthly] Error de red:', err);
    return new Response('Network error', { status: 500 });
  }
};
