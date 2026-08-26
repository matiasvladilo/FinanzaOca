/**
 * Netlify Scheduled Function — Informe Mensual
 *
 * Corre DOS VECES el día 1 de cada mes: 12:00 y 13:00 UTC. Netlify no ajusta
 * el cron por huso horario/DST, y Chile cambia entre UTC-3 (verano) y UTC-4
 * (invierno) — un cron fijo a una sola hora UTC queda mal una parte del año.
 * /api/informes/cron calcula la hora real de Chile en cada disparo (con
 * Intl, no con fechas de corte hardcodeadas) y descarta en silencio el que
 * no caiga justo a las 9:00 — el otro se encarga.
 *
 * Reporta el mes anterior completo (primer al último día).
 *
 * Vars requeridas en Netlify Dashboard:
 *   CRON_SECRET, NEXT_PUBLIC_BASE_URL
 */

export const config = {
  schedule: '0 12,13 1 * *', // 09:00 hora Chile, sea invierno o verano — ver /api/informes/cron
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
