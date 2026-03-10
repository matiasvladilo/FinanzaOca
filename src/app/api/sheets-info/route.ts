/**
 * GET /api/sheets-info
 * Devuelve los nombres de todas las pestañas del spreadsheet.
 * Ruta temporal de diagnóstico.
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

export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: process.env.SHEET_VENTAS_ID ?? '',
      fields: 'sheets.properties(title,sheetId,index)',
    });

    const tabs = meta.data.sheets?.map(s => ({
      nombre: s.properties?.title,
      id:     s.properties?.sheetId,
      orden:  s.properties?.index,
    })) ?? [];

    return NextResponse.json({ ok: true, tabs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
