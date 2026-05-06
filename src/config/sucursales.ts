/**
 * sucursales.ts
 * Configuración centralizada de sucursales.
 * Agregar aquí cada nuevo local cuando se integre al sistema.
 */

export interface SucursalConfig {
  color: string;       // color principal (hex)
  colorLight: string;  // color claro para fondos
  label?: string;      // nombre largo opcional
  lat?: number;        // latitud (para cálculo de eventos cercanos)
  lon?: number;        // longitud
}

/**
 * Mapa de configuración por sucursal.
 * Si una sucursal llega de la API y no está aquí, se le asigna
 * automáticamente un color del pool de fallback.
 */
export const SUCURSAL_CONFIG: Record<string, SucursalConfig> = {
  // Colores visualmente distintos para identificación rápida en gráficos multi-local
  'La Reina': { color: '#2563EB', colorLight: '#DBEAFE', label: 'La Reina',   lat: -33.4521, lon: -70.5718 },
  'PV':       { color: '#10B981', colorLight: '#D1FAE5', label: 'Providencia', lat: -33.4289, lon: -70.6393 },
  'PT':       { color: '#D97706', colorLight: '#FEF3C7', label: 'Puente',      lat: -33.6105, lon: -70.5765 },
  'Bilbao':   { color: '#7C3AED', colorLight: '#EDE9FE', label: 'Bilbao',      lat: -33.4123, lon: -70.5947 },
  'Producción': { color: '#0891B2', colorLight: '#CFFAFE', label: 'Producción' },
  // ─── Agregar nuevos locales aquí ───────────────────────────────────────────
  // 'Nueva Sucursal': { color: '#7C3AED', colorLight: '#EDE9FE', label: 'Nueva Sucursal' },
};

/** Pool de colores para sucursales no configuradas explícitamente */
const FALLBACK_COLORS: SucursalConfig[] = [
  { color: '#7C3AED', colorLight: '#EDE9FE' },
  { color: '#059669', colorLight: '#D1FAE5' },
  { color: '#D97706', colorLight: '#FEF3C7' },
  { color: '#DC2626', colorLight: '#FEE2E2' },
  { color: '#0891B2', colorLight: '#CFFAFE' },
  { color: '#DB2777', colorLight: '#FCE7F3' },
  { color: '#65A30D', colorLight: '#ECFCCB' },
];

export function getSucursalConfig(nombre: string, index: number = 0): SucursalConfig {
  return SUCURSAL_CONFIG[nombre] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function getSucursalColor(nombre: string, index: number = 0): string {
  return getSucursalConfig(nombre, index).color;
}

/** Orden preferido para mostrar sucursales (las no listadas van al final) */
const ORDEN: Record<string, number> = { 'PV': 0, 'La Reina': 1, 'PT': 2, 'Bilbao': 3, 'Producción': 4 };

export function sortSucursales(nombres: string[]): string[] {
  return [...nombres].sort((a, b) => {
    const oa = ORDEN[a] ?? 99;
    const ob = ORDEN[b] ?? 99;
    return oa !== ob ? oa - ob : a.localeCompare(b);
  });
}
