'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { hoyISOChile, ultimoDiaDelMes, toLocalDate } from '@/lib/date-utils';

interface DateRangeCalendarProps {
  /** 'YYYY-MM-DD' o '' si todavía no se eligió */
  desde: string;
  /** 'YYYY-MM-DD' o '' si todavía no se eligió */
  hasta: string;
  /** Se dispara en cada click de día con el par ya resuelto (orden
   *  desde <= hasta garantizado). */
  onRangeChange: (desde: string, hasta: string) => void;
}

const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type DiaCelda = { date: string; day: number; inMonth: boolean };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Arma la grilla de 6×7 (o menos si el mes entra en 5 filas) de un mes,
 *  completando con los días visibles del mes anterior/siguiente para que
 *  la semana siempre arranque en lunes y termine en domingo. */
function construirGrilla(anio: number, mes: number): DiaCelda[][] {
  const primerDia = new Date(anio, mes - 1, 1);
  const offsetInicio = (primerDia.getDay() + 6) % 7; // 0=lunes
  const diasDelMes = ultimoDiaDelMes(anio, mes);
  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anioMesAnterior = mes === 1 ? anio - 1 : anio;
  const diasMesAnterior = ultimoDiaDelMes(anioMesAnterior, mesAnterior);

  const celdas: DiaCelda[] = [];

  for (let i = offsetInicio - 1; i >= 0; i--) {
    const d = diasMesAnterior - i;
    celdas.push({ date: `${anioMesAnterior}-${pad2(mesAnterior)}-${pad2(d)}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= diasDelMes; d++) {
    celdas.push({ date: `${anio}-${pad2(mes)}-${pad2(d)}`, day: d, inMonth: true });
  }
  const mesSiguiente = mes === 12 ? 1 : mes + 1;
  const anioMesSiguiente = mes === 12 ? anio + 1 : anio;
  let diaSiguiente = 1;
  while (celdas.length % 7 !== 0) {
    celdas.push({ date: `${anioMesSiguiente}-${pad2(mesSiguiente)}-${pad2(diaSiguiente)}`, day: diaSiguiente, inMonth: false });
    diaSiguiente++;
  }

  const semanas: DiaCelda[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

function formatoCorto(iso: string): string {
  const d = toLocalDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

const FORMATO_MES_ANIO = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function DateRangeCalendar({ desde, hasta, onRangeChange }: DateRangeCalendarProps) {
  const inicio = desde ? toLocalDate(desde) : null;
  const [vista, setVista] = useState(() => {
    const base = inicio ?? toLocalDate(hoyISOChile())!;
    return { anio: base.getFullYear(), mes: base.getMonth() + 1 };
  });
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const hoy = hoyISOChile();
  const semanas = construirGrilla(vista.anio, vista.mes);

  function cambiarMes(delta: number) {
    setVista(v => {
      let mes = v.mes + delta;
      let anio = v.anio;
      if (mes < 1) { mes = 12; anio -= 1; }
      else if (mes > 12) { mes = 1; anio += 1; }
      return { anio, mes };
    });
  }

  function handleClick(cell: DiaCelda) {
    if (!cell.inMonth) return;
    if (!desde || (desde && hasta)) {
      onRangeChange(cell.date, '');
      return;
    }
    if (cell.date < desde) {
      onRangeChange(cell.date, desde);
    } else {
      onRangeChange(desde, cell.date);
    }
  }

  // Rango "fantasma" que se previsualiza mientras se hace hover después de
  // elegir el primer día y antes de confirmar el segundo.
  let previewStart: string | null = null;
  let previewEnd: string | null = null;
  if (desde && !hasta && hoverDate) {
    previewStart = hoverDate < desde ? hoverDate : desde;
    previewEnd = hoverDate < desde ? desde : hoverDate;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx(
          'flex-1 text-center text-[12px] font-medium rounded-lg px-2 py-1.5 border truncate',
          desde ? 'bg-blue-50 dark:bg-blue-950 border-transparent text-blue-600 dark:text-blue-400'
                : 'bg-white border-gray-200 text-gray-400',
        )}>
          {desde ? formatoCorto(desde) : 'Desde'}
        </div>
        <span className="text-gray-300 text-[11px] flex-shrink-0">→</span>
        <div className={clsx(
          'flex-1 text-center text-[12px] font-medium rounded-lg px-2 py-1.5 border truncate',
          hasta ? 'bg-blue-50 dark:bg-blue-950 border-transparent text-blue-600 dark:text-blue-400'
                : 'bg-white border-gray-200 text-gray-400',
        )}>
          {hasta ? formatoCorto(hasta) : 'Hasta'}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => cambiarMes(-1)} aria-label="Mes anterior"
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: 'var(--text-3)' }}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>
          {capitalizar(FORMATO_MES_ANIO.format(new Date(vista.anio, vista.mes - 1, 1)))}
        </span>
        <button type="button" onClick={() => cambiarMes(1)} aria-label="Mes siguiente"
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: 'var(--text-3)' }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium" style={{ color: 'var(--text-3)' }}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {semanas.flatMap((semana, wi) => semana.map((cell, di) => {
          const isDesde = cell.date === desde;
          const isHasta = cell.date === hasta && hasta !== desde;
          const isEndpoint = isDesde || isHasta;
          const enRangoConfirmado = !!desde && !!hasta && cell.date > desde && cell.date < hasta;
          const enPreview = !!previewStart && !!previewEnd && cell.date > previewStart && cell.date < previewEnd
            && !enRangoConfirmado && !isEndpoint;
          const esHoy = cell.date === hoy;

          return (
            <button
              type="button"
              key={`${wi}-${di}`}
              disabled={!cell.inMonth}
              onClick={() => handleClick(cell)}
              onMouseEnter={() => cell.inMonth && setHoverDate(cell.date)}
              onMouseLeave={() => setHoverDate(null)}
              className={clsx(
                'w-full aspect-square flex items-center justify-center text-[12px] transition-colors',
                !cell.inMonth && 'cursor-default text-gray-300 dark:text-gray-700',
                cell.inMonth && !isEndpoint && 'hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full',
                cell.inMonth && !isEndpoint && !enRangoConfirmado && !enPreview && 'text-gray-700 dark:text-gray-300',
                enRangoConfirmado && 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300',
                enPreview && 'bg-blue-50/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
                isEndpoint && 'bg-blue-600 text-white font-semibold rounded-full',
                esHoy && !isEndpoint && 'ring-1 ring-inset ring-blue-300 dark:ring-blue-700 rounded-full',
              )}
            >
              {cell.day}
            </button>
          );
        }))}
      </div>
    </div>
  );
}
