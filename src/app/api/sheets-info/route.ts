/**
 * GET /api/sheets-info
 * Descubre las pestañas disponibles en los 4 sheets de locales.
 * Ruta de diagnóstico — usar para mapear tab names antes de configurar.
 */
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

const LOCALES = [
  { nombre: 'La Reina', envVar: 'SHEET_LA_REINA_ID' },
  { nombre: 'PV',       envVar: 'SHEET_PV_ID' },
  { nombre: 'PT',       envVar: 'SHEET_PT_ID' },
  { nombre: 'Bilbao',   envVar: 'SHEET_BILBAO_ID' },
];

export async function GET() {
  try {
    const auth = getAuth();
    const sheetsApi = google.sheets({ version: 'v4', auth });

    const results = await Promise.allSettled(
      LOCALES.map(async (local) => {
        const sheetId = process.env[local.envVar] ?? '';
        if (!sheetId) return { local: local.nombre, error: `${local.envVar} no configurado`, tabs: [] };

        const meta = await sheetsApi.spreadsheets.get({
          spreadsheetId: sheetId,
          fields: 'sheets.properties(title,sheetId,index)',
        });

        const tabs = meta.data.sheets?.map(s => ({
          nombre: s.properties?.title,
          id:     s.properties?.sheetId,
          orden:  s.properties?.index,
        })) ?? [];

        return { local: local.nombre, sheetId, tabs };
      })
    );

    const data = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { local: LOCALES[i].nombre, error: (r.reason as Error)?.message ?? 'Error desconocido', tabs: [] };
    });

    return NextResponse.json({ ok: true, locales: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
