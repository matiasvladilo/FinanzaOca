import 'server-only';
import { SUCURSAL_CONFIG } from '@/config/sucursales';

export interface Evento {
  id: string;
  titulo: string;
  fecha: string;       // YYYY-MM-DD (fecha local Chile)
  fechaFin?: string;
  categoria: string;
  etiquetas: string[];
  impacto: number;     // 0–100
  localesCercanos: string[];
  lat?: number;
  lon?: number;
  url?: string;
}

// Radio en km para buscar eventos alrededor de cada local
const RADIO_KM = 3;

// Rank mínimo — solo eventos de alto impacto (70+)
const MIN_RANK = 70;

// Venues específicos que siempre se consultan (no caen dentro del radio de ningún local)
const VENUES_ESPECIALES = [
  {
    nombre: 'Estadio Nacional',
    lat: -33.4573,
    lon: -70.6110,
    radio: 1,
    locales: ['La Reina', 'PV', 'Bilbao'],
    minRank: 0, // incluir todos los partidos sin filtro de rank
  },
];

interface PHQResult {
  id: string;
  title: string;
  start: string;
  end?: string;
  category: string;
  labels: string[];
  rank: number;
  geo?: { geometry?: { coordinates?: [number, number] } };
  url?: string;
}

async function fetchParaLocal(
  sucursal: string,
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
  apiKey: string,
  radio = RADIO_KM,
  minRank = MIN_RANK,
): Promise<{ sucursal: string; results: PHQResult[] }> {
  const params = new URLSearchParams({
    within: `${radio}km@${lat},${lon}`,
    'start.gte': desde,
    'start.lte': hasta,
    category: 'sports,concerts,festivals,performing-arts,community,public-holidays,disasters,severe-weather',
    sort: 'rank',
    limit: '50',
    'rank.gte': String(minRank),
  });

  const res = await fetch(`https://api.predicthq.com/v1/events/?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    console.error(`[predicthq] Error para ${sucursal}:`, res.status, await res.text());
    return { sucursal, results: [] };
  }

  const data = await res.json() as { results?: PHQResult[] };
  return { sucursal, results: data.results ?? [] };
}

export async function fetchEventosSantiago(year: number, month: number): Promise<Evento[]> {
  const apiKey = process.env.PREDICTHQ_API_KEY;

  if (!apiKey) {
    console.warn('[predicthq] PREDICTHQ_API_KEY no configurado — usando mock data');
    return mockEventos(year, month);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const desde = `${year}-${pad(month)}-01`;
  const hasta = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`;

  // Sucursales con coordenadas
  const sucursalesConCoords = Object.entries(SUCURSAL_CONFIG).filter(
    ([, cfg]) => cfg.lat != null && cfg.lon != null,
  );

  // Consultar PredictHQ en paralelo: una query por local + venues especiales
  const responses = await Promise.all([
    ...sucursalesConCoords.map(([nombre, cfg]) =>
      fetchParaLocal(nombre, cfg.lat!, cfg.lon!, desde, hasta, apiKey),
    ),
    ...VENUES_ESPECIALES.map(v =>
      fetchParaLocal(v.nombre, v.lat, v.lon, desde, hasta, apiKey, v.radio, v.minRank).then(r => ({
        sucursal: '__venue__',
        localesForzados: v.locales,
        results: r.results,
      })),
    ),
  ]);

  // Agregar feriados nacionales (sin geo, aplican a todos los locales)
  const feriadosParams = new URLSearchParams({
    'start.gte': desde,
    'start.lte': hasta,
    category: 'public-holidays',
    sort: 'rank',
    limit: '20',
    country: 'CL',
  });
  const feriadosRes = await fetch(`https://api.predicthq.com/v1/events/?${feriadosParams}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    next: { revalidate: 0 },
  });
  const feriadosData = feriadosRes.ok
    ? ((await feriadosRes.json()) as { results?: PHQResult[] }).results ?? []
    : [];

  // Combinar: mapear evento_id → localesCercanos acumulados
  const eventoMap = new Map<string, { result: PHQResult; locales: Set<string> }>();

  for (const resp of responses) {
    const localesForzados = (resp as { localesForzados?: string[] }).localesForzados;
    for (const r of resp.results) {
      if (!eventoMap.has(r.id)) {
        eventoMap.set(r.id, { result: r, locales: new Set() });
      }
      const entry = eventoMap.get(r.id)!;
      if (localesForzados) {
        for (const l of localesForzados) entry.locales.add(l);
      } else {
        entry.locales.add(resp.sucursal);
      }
    }
  }

  // Feriados nacionales → todos los locales
  for (const r of feriadosData) {
    if (!eventoMap.has(r.id)) {
      eventoMap.set(r.id, { result: r, locales: new Set(Object.keys(SUCURSAL_CONFIG)) });
    } else {
      for (const s of Object.keys(SUCURSAL_CONFIG)) {
        eventoMap.get(r.id)!.locales.add(s);
      }
    }
  }

  return Array.from(eventoMap.values()).map(({ result: r, locales }) => {
    const coords = r.geo?.geometry?.coordinates;
    const lon = coords?.[0];
    const lat = coords?.[1];
    const fecha = r.start.slice(0, 10);
    const fechaFin = r.end ? r.end.slice(0, 10) : undefined;
    return {
      id: r.id,
      titulo: r.title,
      fecha,
      fechaFin: fechaFin !== fecha ? fechaFin : undefined,
      categoria: r.category,
      etiquetas: r.labels ?? [],
      impacto: r.rank ?? 0,
      lat,
      lon,
      localesCercanos: Array.from(locales),
      url: r.url,
    };
  });
}

function mockEventos(year: number, month: number): Evento[] {
  const d = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (daysInMonth < 20) return [];

  return [
    {
      id: 'mock-1',
      titulo: 'Maratón de Santiago',
      fecha: d(4),
      categoria: 'sports',
      etiquetas: ['marathon', 'running', 'road-closed'],
      impacto: 85,
      lat: -33.4374,
      lon: -70.6483,
      localesCercanos: ['PV', 'La Reina', 'Bilbao'],
    },
    {
      id: 'mock-2',
      titulo: 'U. de Chile vs Colo-Colo',
      fecha: d(10),
      categoria: 'sports',
      etiquetas: ['football', 'soccer'],
      impacto: 79,
      lat: -33.4654,
      lon: -70.6099,
      localesCercanos: ['La Reina'],
    },
    {
      id: 'mock-3',
      titulo: 'Concierto Movistar Arena',
      fecha: d(15),
      categoria: 'concerts',
      etiquetas: ['concert', 'music'],
      impacto: 62,
      lat: -33.4567,
      lon: -70.6231,
      localesCercanos: ['La Reina', 'PV'],
    },
    {
      id: 'mock-4',
      titulo: 'Cierre Av. Providencia',
      fecha: d(18),
      categoria: 'community',
      etiquetas: ['road-closed'],
      impacto: 45,
      lat: -33.4289,
      lon: -70.6393,
      localesCercanos: ['PV'],
    },
    {
      id: 'mock-5',
      titulo: 'Festival Lollapalooza',
      fecha: d(22),
      fechaFin: d(24),
      categoria: 'festivals',
      etiquetas: ['festival', 'music', 'outdoor'],
      impacto: 92,
      lat: -33.4006,
      lon: -70.5768,
      localesCercanos: ['Bilbao', 'La Reina'],
    },
    {
      id: 'mock-6',
      titulo: 'Feriado Nacional',
      fecha: d(21),
      categoria: 'public-holidays',
      etiquetas: ['public-holiday'],
      impacto: 70,
      localesCercanos: Object.keys(SUCURSAL_CONFIG),
    },
  ];
}
