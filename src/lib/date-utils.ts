/**
 * date-utils.ts
 * Utilidades de fecha centralizadas para FinanzasOca.
 *
 * REGLAS DEL SISTEMA:
 * - Formato interno: YYYY-MM-DD (string)
 * - Zona horaria: siempre hora LOCAL (America/Santiago, UTC-3/UTC-4)
 * - NUNCA usar new Date('YYYY-MM-DD') → se interpreta como UTC midnight
 * - NUNCA usar .toISOString().slice(0,10) para fechas locales → da fecha UTC
 * - SIEMPRE construir Date con new Date(y, m-1, d) → hora local
 */

// ── parseSheetDate ─────────────────────────────────────────────────────────────

/**
 * Convierte una celda de Google Sheets a formato YYYY-MM-DD.
 * Acepta DD/MM/YYYY o D/M/YYYY (formato chileno estándar).
 * Retorna '' para cualquier entrada inválida o vacía.
 */
export function parseSheetDate(raw: string): string {
  if (!raw?.trim()) return '';
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return '';
  const [a, b, c] = parts.map(x => parseInt(x, 10));
  if (!c || c < 2000 || c > 2100) return '';
  let dia: number, mes: number;
  if (b >= 1 && b <= 12) { dia = a; mes = b; }
  else if (a >= 1 && a <= 12) { dia = b; mes = a; }
  else return '';
  if (dia < 1 || dia > 31) return '';
  return `${c}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// ── toLocalDate ────────────────────────────────────────────────────────────────

/**
 * Parsea un string YYYY-MM-DD como medianoche LOCAL (no UTC).
 *
 * Por qué: new Date('2025-03-14') = UTC midnight = 2025-03-13T21:00 en UTC-3.
 * Esto causa errores off-by-one al comparar contra rangos de fecha locales.
 *
 * Retorna null para input inválido o vacío.
 */
export function toLocalDate(isoStr: string): Date | null {
  if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return null;
  const [y, m, d] = isoStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

// ── buildDateRange ─────────────────────────────────────────────────────────────

/**
 * Construye un rango de fechas desde dos strings YYYY-MM-DD en hora LOCAL.
 * - desde: medianoche 00:00:00.000 del día inicial
 * - hasta: 23:59:59.999 del día final
 */
export function buildDateRange(
  desde: string,
  hasta: string,
): { desde: Date | null; hasta: Date | null } {
  let desdeDate: Date | null = null;
  let hastaDate: Date | null = null;
  if (desde) {
    desdeDate = toLocalDate(desde);
  }
  if (hasta) {
    const d = toLocalDate(hasta);
    if (d) hastaDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
  return { desde: desdeDate, hasta: hastaDate };
}

// ── filterByDateRange ──────────────────────────────────────────────────────────

/**
 * Retorna true si `date` cae dentro de [desde, hasta] (inclusive).
 *
 * Comportamiento:
 *   - Si date es null/undefined y hay rango activo → false (excluir)
 *   - Si ambos bounds son null → true (sin filtro)
 *   - Si solo uno está activo → filtra solo por ese bound, null dates excluidos
 */
export function filterByDateRange(
  date: Date | null | undefined,
  desde: Date | null | undefined,
  hasta: Date | null | undefined,
): boolean {
  const rangeActive = desde != null || hasta != null;
  if (!rangeActive) return true;
  if (!date) return false;
  if (desde != null && date < desde) return false;
  if (hasta != null && date > hasta) return false;
  return true;
}

// ── toLocalISODate ─────────────────────────────────────────────────────────────

/**
 * Retorna el string YYYY-MM-DD en hora LOCAL para un Date.
 * Alternativa segura a new Date().toISOString().slice(0,10) que da fecha UTC.
 *
 * Ejemplo: exportar a las 23:30 en Santiago (UTC-3) da la fecha LOCAL correcta.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── isoWeekMonday ──────────────────────────────────────────────────────────────

/**
 * Retorna el YYYY-MM-DD del lunes de la semana que contiene isoDate.
 *
 * Reemplaza getLunesSemana() en ventas/page.tsx que usaba toISOString()
 * y devolvía domingo en lugar de lunes en zonas UTC-3.
 */
export function isoWeekMonday(isoDate: string): string {
  const d = toLocalDate(isoDate);
  if (!d) return isoDate;
  const day = d.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday, 0, 0, 0, 0);
  return toLocalISODate(monday);
}

// ── Límites de un rango en la zona del negocio ────────────────────────────────

/**
 * Las tablas de ConectOca guardan `created_at` como timestamptz, así que para
 * preguntar "¿qué se vendió en agosto?" hay que consultar por INSTANTES, no por
 * fechas sueltas. Y el mes que le importa al negocio es el mes chileno: agosto
 * empieza el 1 a las 00:00 en Santiago, no en UTC.
 *
 * Estas funciones traducen un rango de días calendario a los dos instantes que
 * lo delimitan. NO usarlas para las planillas de Google Sheets: ahí las fechas
 * no tienen hora y se comparan como calendario.
 */

const TZ_NEGOCIO = 'America/Santiago';

/**
 * Minutos que `tz` va adelantada respecto de UTC en ese instante.
 * Chile alterna entre −240 y −180 con el horario de verano, así que no se puede
 * hardcodear el offset.
 */
function offsetMinutos(instante: Date, tz: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instante);
  const p: Record<string, number> = {};
  for (const x of partes) if (x.type !== 'literal') p[x.type] = parseInt(x.value, 10);
  // hour12:false devuelve "24" para la medianoche en algunas versiones de ICU
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return (comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000;
}

/** Instante UTC que corresponde a ese reloj de pared en la zona del negocio. */
function instanteEnZona(
  y: number, mes: number, dia: number,
  h: number, mi: number, s: number, ms: number,
): Date {
  const tentativo = Date.UTC(y, mes - 1, dia, h, mi, s, ms);
  const off1 = offsetMinutos(new Date(tentativo), TZ_NEGOCIO);
  let real = tentativo - off1 * 60000;
  // Si el tentativo cayó del otro lado de un cambio de hora, el offset que
  // corresponde es el del instante corregido.
  const off2 = offsetMinutos(new Date(real), TZ_NEGOCIO);
  if (off2 !== off1) real = tentativo - off2 * 60000;
  return new Date(real);
}

/** Cuántos días tiene ese mes (mes 1-12). */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Convierte un rango de días calendario (YYYY-MM-DD, inclusive en ambos
 * extremos) a los instantes UTC que lo delimitan en hora de Chile: desde las
 * 00:00:00.000 del primer día hasta las 23:59:59.999 del último.
 */
export function limitesUtcDelRango(
  desdeYMD: string,
  hastaYMD: string,
): { desdeISO: string; hastaISO: string } {
  const [dy, dm, dd] = desdeYMD.split('-').map(Number);
  const [hy, hm, hd] = hastaYMD.split('-').map(Number);
  return {
    desdeISO: instanteEnZona(dy, dm, dd, 0, 0, 0, 0).toISOString(),
    hastaISO: instanteEnZona(hy, hm, hd, 23, 59, 59, 999).toISOString(),
  };
}
