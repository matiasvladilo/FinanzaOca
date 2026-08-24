/**
 * GET /api/merma-data
 * Lee "MERMA" de los 4 locales en paralelo y combina los registros.
 *
 * Columnas usadas: PRODUCTO, TIPO, MONTO, FECHA, MES
 *
 * Query params:
 *   local      → filtrar por local canónico ("PV", "La Reina", "PT", "Bilbao")
 *   periodo    → "7d" | "14d" | "mes" | "mes_anterior" | "anio"
 *   fechaDesde → YYYY-MM-DD
 *   fechaHasta → YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server';
import { readSheet, getLocalesConfig } from '@/lib/google-sheets';
import { requireAuth } from '@/lib/auth-api';
import { parseMonto, parseFecha, getMesLabel, getPeriodoRange, findHeader, agruparMontosPorTexto,
         normalizeRetiroCorporativo, esMermaCorporativa, esRetiroCorporativoConocido } from '@/lib/data/parsers';
import { buildDateRange, filterByDateRange, toLocalISODate } from '@/lib/date-utils';
import { withCacheSWR } from '@/lib/data/cache';

const COLORES_MERMA = ['#3B82F6', '#8B5CF6', '#06B6D4', '#10B981', '#F97316', '#EF4444', '#D1D5DB'];

/** Fila de merma que no se puede imputar a ningún mes por su fecha. */
export interface MermaSinFecha {
  local: string;
  fila: number;
  producto: string;
  tipo: string;
  monto: number;
  valorCelda: string;
}

async function fetchLocalMerma(nombre: string, sheetId: string, tab: string) {
  const rows = await readSheet(sheetId, `${tab}!A1:G5000`);
  if (rows.length < 2) return { registros: [], sinFecha: [] as MermaSinFecha[] };

  const [headers, ...data] = rows;
  const idx = {
    // PT usa "Columna 1" como header de producto
    producto: findHeader(headers, 'PRODUCTO', 'Producto', 'producto', 'Columna 1'),
    // Todos tienen "TIPO " con espacio extra o "TIPO" sin espacio
    tipo:     findHeader(headers, 'TIPO', 'tipo', 'Tipo'),
    monto:    findHeader(headers, 'MONTO', 'monto', 'Monto'),
    fecha:    findHeader(headers, 'FECHA', 'Fecha', 'fecha'),
    mes:      findHeader(headers, 'MES', 'Mes', 'mes'),
  };

  const registros = [];
  // Filas con monto pero sin fecha utilizable: no se pueden imputar a ningún
  // mes y quedan fuera de todas las vistas. Antes desaparecían en silencio; se
  // reportan con su número de fila para corregirlas en la planilla.
  const sinFecha: MermaSinFecha[] = [];

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    if (!r[idx.monto]) continue;

    const fechaParsed = parseFecha(r[idx.fecha] ?? '');
    const tipoOriginal = r[idx.tipo] ?? 'Sin tipo';
    const productoRaw = r[idx.producto] ?? '';
    // El nombre manda sobre el Tipo tipeado: si el producto es un retiro
    // corporativo conocido, la fila se reclasifica como Corporativo aunque el
    // dropdown de Tipo se haya seleccionado mal en la planilla (pasa: "marce"
    // con Tipo=Verdura por $192.500 en La Reina). Si el Tipo ya decía
    // Corporativo pero el nombre no está en el mapa (ej. "Otros", "asado"),
    // sólo se normaliza el nombre, sin tocar el tipo.
    const esRetiro = esRetiroCorporativoConocido(productoRaw);
    const tipo = esRetiro ? 'Corporativo' : tipoOriginal;
    const producto = esRetiro
      ? normalizeRetiroCorporativo(productoRaw)
      : (esMermaCorporativa(tipoOriginal) ? normalizeRetiroCorporativo(productoRaw) : productoRaw);
    const monto = parseMonto(r[idx.monto] ?? '');

    if (!fechaParsed.date) {
      // Sin monto no hay plata sin contabilizar: es basura en la celda del
      // total y reportarla sería ruido para quien corrige la planilla.
      if (monto > 0) {
        sinFecha.push({
          local: nombre,
          fila: i + 2,            // +2: la fila 1 son los encabezados
          producto: productoRaw.trim(),
          tipo: tipo.trim(),
          monto,
          valorCelda: (r[idx.fecha] ?? '').trim(),
        });
      }
      continue;
    }

    registros.push({
      id:       i + 1,
      producto,
      tipo,
      monto,
      fecha:    r[idx.fecha] ?? '',
      mes:      parseInt(r[idx.mes] ?? '0', 10) || fechaParsed.mes,
      anio:     fechaParsed.anio,
      date:     fechaParsed.date,
      local:    nombre,   // nombre canónico forzado por sheet
    });
  }

  return { registros, sinFecha };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;
    const localParam      = searchParams.get('local')      ?? 'todos';
    const periodoParam    = searchParams.get('periodo')     ?? '';
    const fechaDesdeParam = searchParams.get('fechaDesde')  ?? '';
    const fechaHastaParam = searchParams.get('fechaHasta')  ?? '';
    const scopeParam      = searchParams.get('scope')       ?? '';

    const locales = getLocalesConfig();

    // ── scope=todo: histórico completo, los 4 locales, sin filtrar ───────────
    // Lo consume el explorador de la página, que cruza producto × local × mes
    // del lado del cliente. Son ~1.600 filas: pivotear en el browser es
    // instantáneo y evita un viaje al servidor por cada combinación.
    if (scopeParam === 'todo') {
      const todos = await withCacheSWR('merma-todo-v2', async () => {
        const res = await Promise.allSettled(
          locales.map(l => fetchLocalMerma(l.nombre, l.id, l.tabs.merma)),
        );
        return res.flatMap((r, i) => {
          if (r.status === 'fulfilled') return r.value.registros;
          console.error(`[merma-data] Error leyendo ${locales[i].nombre}:`, r.reason);
          return [];
        });
      });

      const registrosTodos = todos
        .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
        .map(r => ({
          id: `${r.local}-${r.id}`, producto: r.producto, tipo: r.tipo,
          monto: r.monto, fecha: r.fecha, local: r.local,
          // "YYYY-MM" precalculado: el cliente agrupa por mes y parsear la
          // fecha en cada render de 1.600 filas es trabajo al pedo.
          mesKey: `${r.anio}-${String(r.mes).padStart(2, '0')}`,
        }));

      return NextResponse.json({
        ok: true,
        registros: registrosTodos,
        locales: ['Todos', ...locales.map(l => l.nombre)],
      });
    }

    // Si se filtra por local específico, solo leer ese sheet
    const localesALeer = (localParam && localParam !== 'todos' && localParam !== 'Todos')
      ? locales.filter(l => l.nombre.toLowerCase() === localParam.toLowerCase())
      : locales;

    const results = await Promise.allSettled(
      localesALeer.map(l => fetchLocalMerma(l.nombre, l.id, l.tabs.merma))
    );

    let registros = results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value.registros;
      console.error(`[merma-data] Error leyendo ${localesALeer[i].nombre}:`, r.reason);
      return [];
    });

    // Filas descartadas por fecha inválida. No dependen del filtro de período
    // (justamente no se pueden ubicar en el tiempo), así que van completas.
    const sinFecha = results
      .flatMap(r => (r.status === 'fulfilled' ? r.value.sinFecha : []))
      .sort((a, b) => b.monto - a.monto);

    // ── Serie diaria, SIN el filtro de período ────────────────────────────────
    // Se calcula antes de aplicar el filtro de fecha (que sí respeta el de
    // local, porque localesALeer ya viene acotado) para que el cliente pueda
    // comparar el período elegido contra el inmediatamente anterior — o armar
    // la tendencia semanal — sin pedir el endpoint una segunda vez.
    const porDiaMap: Record<string, number> = {};
    for (const r of registros) {
      if (!r.date) continue;
      const key = toLocalISODate(r.date);
      porDiaMap[key] = (porDiaMap[key] ?? 0) + r.monto;
    }
    const porDia = Object.entries(porDiaMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, monto]) => ({ fecha, monto }));

    // ── Rango de fechas ──────────────────────────────────────────────────────
    let desde: Date | null = null;
    let hasta: Date | null = null;
    if (fechaDesdeParam || fechaHastaParam) {
      // buildDateRange construye fechas en hora LOCAL (evita el bug UTC de new Date('YYYY-MM-DD'))
      ({ desde, hasta } = buildDateRange(fechaDesdeParam, fechaHastaParam));
    } else if (periodoParam) {
      const range = getPeriodoRange(periodoParam);
      desde = range.desde;
      hasta = range.hasta;
    }

    // filterByDateRange excluye registros sin fecha cuando hay filtro activo
    if (desde || hasta) {
      registros = registros.filter(r => filterByDateRange(r.date, desde, hasta));
    }

    // ── Locales disponibles ──────────────────────────────────────────────────
    const localesDisponibles = ['Todos', ...locales.map(l => l.nombre)];

    // ── KPI ──────────────────────────────────────────────────────────────────
    const totalMerma = registros.reduce((s, r) => s + r.monto, 0);

    // ── Agrupado por mes ─────────────────────────────────────────────────────
    const porMes: Record<string, { mes: number; anio: number; monto: number }> = {};
    for (const r of registros) {
      if (!r.mes) continue;
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      if (!porMes[key]) porMes[key] = { mes: r.mes, anio: r.anio, monto: 0 };
      porMes[key].monto += r.monto;
    }
    const chartData = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ fecha: getMesLabel(v.mes, v.anio), monto: v.monto }));

    // ── Agrupado por tipo ────────────────────────────────────────────────────
    // Cada local carga el "TIPO" a mano: "Corporativo" en un local y
    // "corporativo" en otro son el mismo motivo mal escrito, no dos categorías
    // distintas. agruparMontosPorTexto las junta por texto normalizado.
    const porTipo = agruparMontosPorTexto(registros.map(r => ({ texto: r.tipo, monto: r.monto })))
      .map(({ nombre, monto }, i) => ({
        nombre, monto,
        porcentaje: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
        color: COLORES_MERMA[i % COLORES_MERMA.length],
      }));

    // ── Registros del período ────────────────────────────────────────────────
    // Se devuelven TODOS los del período, no una muestra: la página filtra y
    // busca sobre esta lista, y con un tope de 20 no se podía responder "de qué
    // se compone la merma corporativa de junio" — la búsqueda sólo veía esas 20
    // filas. El histórico completo son ~1.600 registros entre los 4 locales, así
    // que cabe de sobra en una respuesta y evita un segundo endpoint.
    //
    // `registros` es la concatenación de los 4 locales en el orden de
    // getLocalesConfig(), NO viene ordenada por fecha: hay que ordenarla antes
    // de mandarla, o la tabla queda agrupada por local en vez de cronológica.
    const registrosPeriodo = [...registros]
      .filter(r => r.date)
      .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime())
      .map(r => ({
        id: `${r.local}-${r.id}`, producto: r.producto, tipo: r.tipo,
        monto: r.monto, fecha: r.fecha, local: r.local,
      }));

    return NextResponse.json({
      ok: true,
      kpi: {
        totalMerma,
        totalRegistros: registros.length,
        tipoMasFrecuente: porTipo[0]?.nombre ?? '—',
        montoMayor: porTipo[0]?.monto ?? 0,
      },
      chartData,
      porTipo,
      porDia,
      registros: registrosPeriodo,
      // Alias histórico: la página vieja leía este campo. Ahora trae todo el
      // período, no sólo los últimos 20.
      ultimosRegistros: registrosPeriodo,
      sinFecha,
      locales: localesDisponibles,
      filtros: { local: localParam, periodo: periodoParam },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── Función reutilizable para informes ────────────────────────────────────────

export interface MermaReportData {
  totalMerma: number;
  porTipo: Array<{ tipo: string; monto: number; pct: number }>;
  porLocal: Array<{ local: string; monto: number; pct: number }>;
}

export async function fetchMermaForReport(fechaDesde: string, fechaHasta: string): Promise<MermaReportData> {
  try {
    const { desde, hasta } = buildDateRange(fechaDesde, fechaHasta);
    const locales = getLocalesConfig();

    const results = await Promise.allSettled(
      locales.map(l => fetchLocalMerma(l.nombre, l.id, l.tabs.merma))
    );

    let registros = results.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value.registros;
      console.error(`[merma-data] fetchMermaForReport error ${locales[i].nombre}:`, r.reason);
      return [];
    });

    if (desde || hasta) {
      registros = registros.filter(r => filterByDateRange(r.date, desde, hasta));
    }

    const totalMerma = registros.reduce((s, r) => s + r.monto, 0);

    const porTipo = agruparMontosPorTexto(registros.map(r => ({ texto: r.tipo, monto: r.monto })))
      .map(({ nombre, monto }) => ({
        tipo: nombre, monto,
        pct: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
      }));

    const localMap: Record<string, number> = {};
    for (const r of registros) localMap[r.local] = (localMap[r.local] ?? 0) + r.monto;
    const porLocal = Object.entries(localMap)
      .sort(([, a], [, b]) => b - a)
      .map(([local, monto]) => ({
        local, monto,
        pct: totalMerma > 0 ? Math.round((monto / totalMerma) * 100) : 0,
      }));

    return { totalMerma, porTipo, porLocal };
  } catch (err) {
    console.error('[merma-data] fetchMermaForReport:', err);
    return { totalMerma: 0, porTipo: [], porLocal: [] };
  }
}
