/**
 * parsers.ts
 * Funciones centralizadas de parseo y normalización de datos.
 * Reemplaza las versiones duplicadas en cada route handler.
 *
 * SOLO usar en server-side (route handlers, server components).
 */

// ── Meses ─────────────────────────────────────────────────────────────────────

export const MESES_SHORT = [
  '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

/** "3, 2025" → "Mar 2025" */
export function getMesLabel(mes: number, anio: number): string {
  return `${MESES_SHORT[mes] ?? mes} ${anio}`;
}

/** "2025-03" → "Mar 2025" */
export function getMesKeyLabel(key: string): string {
  const [anio, mes] = key.split('-');
  return getMesLabel(parseInt(mes, 10), parseInt(anio, 10));
}

// ── Montos ────────────────────────────────────────────────────────────────────

/**
 * Parsea strings de montos en múltiples formatos chilenos:
 *   "$30.770"  →  30770
 *   "30.770"   →  30770
 *   "30,77"    →  30.77
 *   "30770"    →  30770
 */
export function parseMonto(raw: string): number {
  if (!raw) return 0;
  // Quita $, espacios; luego puntos de miles; reemplaza coma decimal por punto
  const clean = raw
    .replace(/\$|\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(clean) || 0;
}

// ── Fechas ────────────────────────────────────────────────────────────────────

export interface ParsedFecha {
  dia: number;
  mes: number;
  anio: number;
  iso: string;          // "YYYY-MM-DD" o ""
  date: Date | null;
}

const EMPTY_FECHA: ParsedFecha = { dia: 0, mes: 0, anio: 0, iso: '', date: null };

/**
 * Parsea fechas en formato "DD/MM/YYYY" o "D/M/YYYY" (estándar chileno).
 * Detecta automáticamente si el día y el mes están invertidos.
 */
export function parseFecha(raw: string): ParsedFecha {
  if (!raw?.trim()) return EMPTY_FECHA;

  const parts = raw.trim().split('/');
  if (parts.length !== 3) return EMPTY_FECHA;

  const nums = parts.map(x => parseInt(x, 10));
  const [a, b, c] = nums;

  // El año siempre es el tercer componente y debe ser >= 2000 y <= 2100
  if (!c || c < 2000 || c > 2100) return EMPTY_FECHA;

  // DD/MM/YYYY: b es mes si está en rango 1–12
  // Si b > 12, intentar a como mes (M/DD/YYYY edge case)
  let dia: number, mes: number;
  if (b >= 1 && b <= 12) {
    dia = a;
    mes = b;
  } else if (a >= 1 && a <= 12) {
    dia = b;
    mes = a;
  } else {
    return EMPTY_FECHA;
  }

  const anio = c;
  const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const date = new Date(anio, mes - 1, dia || 1);

  return { dia, mes, anio, iso, date };
}

// ── Normalización de locales ──────────────────────────────────────────────────

/**
 * Normaliza cualquier variante del nombre de un local a los 4 nombres canónicos.
 * Maneja variantes como "OCA LA REINA", "PROVIDENCIA", "PUENTE ALTO", etc.
 *
 * Canónicos: "PV" | "La Reina" | "PT" | "Bilbao"
 */
export function normalizeLocalName(raw: string): string {
  if (!raw?.trim()) return '';
  const s = raw.trim().toUpperCase();

  if (s.includes('LA REINA'))                               return 'La Reina';
  if (s.includes('BILBAO'))                                 return 'Bilbao';
  if (s.includes('PT') || s.includes('PUENTE'))             return 'PT';
  if (s.includes('PV') || s.includes('PROVIDENCIA'))        return 'PV';

  // Fallback: retornar tal como está (sin romper locales futuros)
  return raw.trim();
}

// ── Header lookup (case-insensitive, trim) ────────────────────────────────────

/**
 * Busca el índice de un header en un array de strings.
 * Acepta múltiples candidatos y hace matching case-insensitive + trim.
 * Retorna el primer índice que coincide, o -1 si no encuentra ninguno.
 */
export function findHeader(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const norm = candidate.trim().toLowerCase();
    const idx = headers.findIndex(h => h.trim().toLowerCase() === norm);
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Rango de períodos ─────────────────────────────────────────────────────────

export interface DateRange {
  desde: Date | null;
  hasta: Date | null;
}

/**
 * Convierte un string de período a un rango de fechas.
 * Usado en /api/merma-data y futuros endpoints con filtro de período.
 */
export function getPeriodoRange(periodo: string): DateRange {
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);

  switch (periodo) {
    case '7d': {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 6);
      desde.setHours(0, 0, 0, 0);
      return { desde, hasta: hoy };
    }
    case '14d': {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 13);
      desde.setHours(0, 0, 0, 0);
      return { desde, hasta: hoy };
    }
    case 'mes': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0);
      return { desde, hasta: hoy };
    }
    case 'mes_anterior': {
      const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1, 0, 0, 0, 0);
      const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999);
      return { desde, hasta };
    }
    case 'anio': {
      const desde = new Date(hoy.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { desde, hasta: hoy };
    }
    default:
      return { desde: null, hasta: null };
  }
}
