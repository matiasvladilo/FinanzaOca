/**
 * Gasto Fijo — lector de Google Sheets
 *
 * Cada local tiene su propia hoja (La Reina, PV, PT, Bilbao) con columnas:
 *   local | categoria | monto | mes | año
 *
 * Exporta fetchGastoFijoForReport para ser usado internamente por /api/informes/generate.
 */

import { readSheet } from '@/lib/google-sheets';

const SHEET_ID = process.env.SHEET_GASTO_FIJO_ID ?? '';

// Mapeo: nombre de hoja en el Sheet → nombre canónico del local en el sistema
const LOCALES_MAP: Record<string, string> = {
  'LAREINA':    'La Reina',
  'PV':         'PV',
  'PT':         'PT',
  'BILBAO':     'Bilbao',
  'PRODUCCION': 'Producción',
};

const SHEET_TABS = Object.keys(LOCALES_MAP);

export interface GastoFijoCategoria {
  categoria: string;
  monto: number;
}

export interface GastoFijoLocal {
  local: string;
  total: number;
  categorias: GastoFijoCategoria[];
}

export interface GastoFijoData {
  porLocal: GastoFijoLocal[];
  totalGeneral: number;
}

export interface GastoIndirectoData {
  categorias: GastoFijoCategoria[];
  total: number;
}

// ── Construir lista de (año, mes) que cubre el rango fechaDesde..fechaHasta ──

function monthsInRange(fechaDesde: string, fechaHasta: string): Set<string> {
  const [yearFrom, monthFrom] = fechaDesde.split('-').map(Number);
  const [yearTo, monthTo]     = fechaHasta.split('-').map(Number);
  const set = new Set<string>();
  let y = yearFrom, m = monthFrom;
  while (y * 12 + m <= yearTo * 12 + monthTo) {
    set.add(`${y}-${m}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return set;
}

// ── Normaliza header: minúsculas sin tildes para matching robusto ─────────────

function normalizeHeader(s: string): string {
  return s.toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
    .trim();
}

// ── Parsear monto: acepta "1.234.567", "1234567", "1234,5" ───────────────────

function parseMonto(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

// ── Fetch principal ───────────────────────────────────────────────────────────

export async function fetchGastoFijoForReport(
  fechaDesde: string,
  fechaHasta: string,
): Promise<GastoFijoData> {
  if (!SHEET_ID) {
    console.warn('[GastoFijo] SHEET_GASTO_FIJO_ID no configurado');
    return { porLocal: [], totalGeneral: 0 };
  }

  const mesesValidos = monthsInRange(fechaDesde, fechaHasta);
  console.log('[GastoFijo] Meses válidos:', [...mesesValidos]);

  const results = await Promise.allSettled(
    SHEET_TABS.map(async (tab) => {
      const localNombre = LOCALES_MAP[tab];
      const raw = await readSheet(SHEET_ID, `${tab}!A1:ZZ`);
      if (!raw.length) {
        console.warn(`[GastoFijo] Hoja "${tab}" vacía o sin datos`);
        return { local: localNombre, total: 0, categorias: [] } as GastoFijoLocal;
      }

      // Mapear headers con normalización
      const headers = raw[0].map(normalizeHeader);
      console.log(`[GastoFijo] "${tab}" headers:`, headers);

      const idxCat   = headers.findIndex(h => h === 'categoria');
      const idxMonto = headers.findIndex(h => h === 'monto');
      const idxMes   = headers.findIndex(h => h === 'mes');
      const idxAnio  = headers.findIndex(h => h === 'ano' || h === 'año');

      console.log(`[GastoFijo] "${tab}" idxCat=${idxCat} idxMonto=${idxMonto} idxMes=${idxMes} idxAnio=${idxAnio}`);

      const dataRows = raw.slice(1);

      // Filtrar por mes/año dentro del rango
      const filtradas = dataRows.filter(row => {
        const mes  = parseInt(row[idxMes]  ?? '', 10);
        const anio = parseInt(row[idxAnio] ?? '', 10);
        if (isNaN(mes) || isNaN(anio)) return false;
        return mesesValidos.has(`${anio}-${mes}`);
      });

      console.log(`[GastoFijo] "${tab}" filas totales=${dataRows.length} filtradas=${filtradas.length}`);

      // Agrupar por categoría
      const catMap: Record<string, number> = {};
      for (const row of filtradas) {
        const cat   = (row[idxCat] ?? '').trim() || 'Sin categoría';
        const monto = parseMonto(row[idxMonto] ?? '');
        catMap[cat] = (catMap[cat] ?? 0) + monto;
      }

      const categorias: GastoFijoCategoria[] = Object.entries(catMap)
        .map(([categoria, monto]) => ({ categoria, monto }))
        .sort((a, b) => b.monto - a.monto);

      const total = categorias.reduce((s, c) => s + c.monto, 0);
      console.log(`[GastoFijo] "${tab}" total=${total}`);

      return { local: localNombre, total, categorias } as GastoFijoLocal;
    }),
  );

  const porLocal: GastoFijoLocal[] = results
    .filter((r): r is PromiseFulfilledResult<GastoFijoLocal> => {
      if (r.status === 'rejected') {
        console.error('[GastoFijo] Error leyendo local:', r.reason);
      }
      return r.status === 'fulfilled';
    })
    .map(r => r.value)
    .filter(l => l.total > 0);

  const totalGeneral = porLocal.reduce((s, l) => s + l.total, 0);
  console.log('[GastoFijo] totalGeneral=', totalGeneral, 'locales=', porLocal.map(l => l.local));

  return { porLocal, totalGeneral };
}

// ── Gasto Indirecto (hoja "GASTO_INDIRECTO", sin relación a local) ────────────

export async function fetchGastoIndirectoForReport(
  fechaDesde: string,
  fechaHasta: string,
): Promise<GastoIndirectoData> {
  if (!SHEET_ID) {
    console.warn('[GastoIndirecto] SHEET_GASTO_FIJO_ID no configurado');
    return { categorias: [], total: 0 };
  }

  const mesesValidos = monthsInRange(fechaDesde, fechaHasta);

  let raw: string[][];
  try {
    raw = await readSheet(SHEET_ID, 'GASTO INDIRECTO!A1:ZZ');
  } catch (err) {
    console.warn('[GastoIndirecto] Error leyendo hoja "GASTO INDIRECTO":', err);
    return { categorias: [], total: 0 };
  }

  if (!raw.length) {
    console.warn('[GastoIndirecto] Hoja "GASTO INDIRECTO" vacía');
    return { categorias: [], total: 0 };
  }

  const headers = raw[0].map(normalizeHeader);
  const idxCat   = headers.findIndex(h => h === 'categoria');
  const idxMonto = headers.findIndex(h => h === 'monto');
  const idxMes   = headers.findIndex(h => h === 'mes');
  const idxAnio  = headers.findIndex(h => h === 'ano' || h === 'año');

  const dataRows = raw.slice(1);
  const filtradas = dataRows.filter(row => {
    const mes  = parseInt(row[idxMes]  ?? '', 10);
    const anio = parseInt(row[idxAnio] ?? '', 10);
    if (isNaN(mes) || isNaN(anio)) return false;
    return mesesValidos.has(`${anio}-${mes}`);
  });

  const catMap: Record<string, number> = {};
  for (const row of filtradas) {
    const cat   = (row[idxCat] ?? '').trim() || 'Sin categoría';
    const monto = parseMonto(row[idxMonto] ?? '');
    catMap[cat] = (catMap[cat] ?? 0) + monto;
  }

  const categorias: GastoFijoCategoria[] = Object.entries(catMap)
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto);

  const total = categorias.reduce((s, c) => s + c.monto, 0);
  console.log('[GastoIndirecto] total=', total);

  return { categorias, total };
}
