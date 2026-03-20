/**
 * Netlify Scheduled Function — Automated Report Sender
 *
 * Runs on cron schedules and triggers the /api/informes/cron endpoint.
 * Configure via netlify.toml [functions] sections below.
 *
 * Required env vars (set in Netlify dashboard):
 *   CRON_SECRET          - Secret token to authenticate cron calls
 *   NEXT_PUBLIC_BASE_URL - The deployed site URL (e.g. https://yoursite.netlify.app)
 *   REPORT_RECIPIENTS    - Comma-separated email list
 *   RESEND_API_KEY       - Resend API key
 *   RESEND_FROM          - Sender email (e.g. informes@yourdomain.com)
 */

// Types for Netlify scheduled functions
// Install @netlify/functions for full type support: npm install -D @netlify/functions
type Config = { schedule: string };
type Context = Record<string, unknown>;

async function triggerReport(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const secret  = process.env.CRON_SECRET;

  if (!baseUrl || !secret) {
    console.error(`[scheduled-reports] Missing env vars: NEXT_PUBLIC_BASE_URL or CRON_SECRET`);
    return;
  }

  const url = `${baseUrl}/api/informes/cron?type=${type}&secret=${encodeURIComponent(secret)}`;

  console.log(`[scheduled-reports] Triggering ${type} report → ${url}`);

  try {
    const res = await fetch(url, { method: 'GET' });
    const body = await res.json() as Record<string, unknown>;
    if (body.ok) {
      console.log(`[scheduled-reports] ${type} report sent successfully`, body);
    } else {
      console.error(`[scheduled-reports] ${type} report failed`, body);
    }
  } catch (err) {
    console.error(`[scheduled-reports] Network error for ${type}:`, err);
  }
}

// ── Daily report (every day at 08:00 Chile time = 11:00 UTC) ──────────────────
export const dailyReport = async (_req: Request, _context: Context) => {
  await triggerReport('daily');
  return new Response('daily report triggered', { status: 200 });
};

export const dailyConfig: Config = {
  schedule: '0 11 * * *', // 08:00 CLT (UTC-3)
};

// ── Weekly report (every Monday at 08:30 Chile time) ──────────────────────────
export const weeklyReport = async (_req: Request, _context: Context) => {
  await triggerReport('weekly');
  return new Response('weekly report triggered', { status: 200 });
};

export const weeklyConfig: Config = {
  schedule: '30 11 * * 1', // 08:30 CLT on Mondays
};

// ── Monthly report (1st of each month at 09:00 Chile time) ───────────────────
export const monthlyReport = async (_req: Request, _context: Context) => {
  await triggerReport('monthly');
  return new Response('monthly report triggered', { status: 200 });
};

export const monthlyConfig: Config = {
  schedule: '0 12 1 * *', // 09:00 CLT on 1st of month
};

// Default export for Netlify (required)
export default async function handler(_req: Request, _context: Context) {
  // Manual trigger endpoint — detects which type from URL
  const url = new URL(_req.url);
  const type = url.searchParams.get('type') as 'daily' | 'weekly' | 'monthly' | null;
  if (type && ['daily', 'weekly', 'monthly'].includes(type)) {
    await triggerReport(type);
    return new Response(`${type} report triggered`, { status: 200 });
  }
  return new Response('Netlify Scheduled Reports Function - OK', { status: 200 });
}
