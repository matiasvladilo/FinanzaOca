/**
 * report-settings.ts
 * Interruptor real (no un checkbox decorativo) para el envío de los informes
 * automáticos semanal y mensual. Se guarda en Netlify Blobs — el único store
 * persistente disponible sin agregar una base de datos nueva, y que ya viene
 * gratis con el sitio en Netlify (zero-config en runtime: el propio Next
 * runtime de Netlify inyecta las credenciales, no hace falta configurar nada
 * en .env.local para producción).
 *
 * En local (`next dev`) normalmente no hay contexto de Netlify disponible,
 * así que las lecturas/escrituras van a fallar — se cae a "todo activado"
 * (el comportamiento de siempre) en vez de romper el cron o el build.
 */

import { getStore } from '@netlify/blobs';

export interface ReportSettings {
  weeklyEnabled: boolean;
  monthlyEnabled: boolean;
}

const DEFAULTS: ReportSettings = { weeklyEnabled: true, monthlyEnabled: true };

const STORE_NAME = 'report-settings';
const KEY = 'settings';

function store() {
  return getStore(STORE_NAME);
}

export async function getReportSettings(): Promise<ReportSettings> {
  try {
    const raw = await store().get(KEY, { type: 'json' });
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    const s = raw as Partial<ReportSettings>;
    return {
      weeklyEnabled:  typeof s.weeklyEnabled  === 'boolean' ? s.weeklyEnabled  : DEFAULTS.weeklyEnabled,
      monthlyEnabled: typeof s.monthlyEnabled === 'boolean' ? s.monthlyEnabled : DEFAULTS.monthlyEnabled,
    };
  } catch (err) {
    // Sin contexto de Netlify Blobs (típico en local) — no bloquear nada,
    // asumir todo activado como siempre se comportó antes de este toggle.
    console.warn('[report-settings] No se pudo leer el store (¿corriendo fuera de Netlify?), uso defaults:', err);
    return { ...DEFAULTS };
  }
}

export async function setReportSettings(partial: Partial<ReportSettings>): Promise<ReportSettings> {
  const actual = await getReportSettings();
  const next: ReportSettings = { ...actual, ...partial };
  await store().setJSON(KEY, next);
  return next;
}
