/**
 * GET /api/debug-headers
 * Muestra los headers reales de cada pestaña en los 4 sheets.
 * Solo para diagnóstico — no usar en producción.
 */
import { NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';

export async function GET() {
  const locales = getLocalesConfig();

  const results = await Promise.allSettled(
    locales.map(async (l) => {
      const tabs: Record<string, string[]> = {};
      for (const [tabKey, tabName] of Object.entries(l.tabs)) {
        try {
          const rows = await readSheet(l.id, `${tabName}!A1:Z1`);
          tabs[tabKey] = rows[0] ?? [];
        } catch (e) {
          tabs[tabKey] = [`ERROR: ${(e as Error).message}`];
        }
      }
      return { local: l.nombre, tabs };
    })
  );

  const data = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return { local: locales[i].nombre, error: (r.reason as Error)?.message };
  });

  return NextResponse.json({ ok: true, headers: data });
}
