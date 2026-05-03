'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, MapPin, ExternalLink, CalendarDays, List, Calendar } from 'lucide-react';
import clsx from 'clsx';
import { SUCURSAL_CONFIG } from '@/config/sucursales';
import type { Evento } from '@/lib/predicthq';

type EventoClient = Evento;

interface CatCfg { emoji: string; color: string; bg: string; label: string }

const CAT_CONFIG: Record<string, CatCfg> = {
  sports:            { emoji: '⚽', color: '#DC2626', bg: '#FEE2E2', label: 'Deporte' },
  concerts:          { emoji: '🎵', color: '#7C3AED', bg: '#EDE9FE', label: 'Concierto' },
  festivals:         { emoji: '🎪', color: '#D97706', bg: '#FEF3C7', label: 'Festival' },
  'performing-arts': { emoji: '🎭', color: '#0891B2', bg: '#CFFAFE', label: 'Artes' },
  community:         { emoji: '👥', color: '#059669', bg: '#D1FAE5', label: 'Comunidad' },
  'public-holidays': { emoji: '📅', color: '#2563EB', bg: '#DBEAFE', label: 'Feriado' },
  disasters:         { emoji: '⚠️', color: '#991B1B', bg: '#FEE2E2', label: 'Emergencia' },
  'severe-weather':  { emoji: '🌩️', color: '#374151', bg: '#F3F4F6', label: 'Clima' },
};

const EXTRA_CATS: CatCfg[] = [
  { emoji: '🏃', color: '#EA580C', bg: '#FFEDD5', label: 'Maratón' },
  { emoji: '🚧', color: '#B45309', bg: '#FEF3C7', label: 'Cierre' },
];

function getCatCfg(categoria: string, etiquetas: string[]): CatCfg {
  if (etiquetas.some(e => ['marathon', 'running', 'triathlon'].includes(e)))
    return { emoji: '🏃', color: '#EA580C', bg: '#FFEDD5', label: 'Maratón' };
  if (etiquetas.some(e => ['road-closed', 'street-closure', 'road-closure'].includes(e)))
    return { emoji: '🚧', color: '#B45309', bg: '#FEF3C7', label: 'Cierre' };
  return CAT_CONFIG[categoria] ?? { emoji: '📌', color: '#6B7280', bg: '#F3F4F6', label: 'Evento' };
}

const DIAS        = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DIAS_FULL   = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES       = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                     'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDow + 6) % 7;
  const grid: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function diaNombreCorto(year: number, month: number, day: number): string {
  const dow = new Date(year, month - 1, day).getDay();
  const nombre = DIAS_FULL[(dow + 6) % 7];
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EventosPage() {
  const today = new Date();
  const [anio, setAnio]               = useState(today.getFullYear());
  const [mes,  setMes]                = useState(today.getMonth() + 1);
  const [localSel, setLocalSel]       = useState<string>('');
  const [eventos, setEventos]         = useState<EventoClient[]>([]);
  const [loading, setLoading]         = useState(false);
  const [modalEvento, setModalEvento] = useState<EventoClient | null>(null);
  const [modalDia, setModalDia]       = useState<{ day: number; lista: EventoClient[] } | null>(null);
  const [vista, setVista]             = useState<'calendario' | 'agenda'>('agenda');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/eventos?year=${anio}&month=${mes}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setEventos(d.eventos ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [anio, mes]);

  const locales = Object.keys(SUCURSAL_CONFIG);

  const eventosFiltrados = useMemo(() => {
    if (!localSel) return eventos;
    return eventos.filter(e => e.localesCercanos.includes(localSel));
  }, [eventos, localSel]);

  const porDia = useMemo(() => {
    const map: Record<string, EventoClient[]> = {};
    for (const e of eventosFiltrados) {
      if (!map[e.fecha]) map[e.fecha] = [];
      map[e.fecha].push(e);
      if (e.fechaFin && e.fechaFin > e.fecha) {
        const start = new Date(e.fecha + 'T00:00:00');
        const end   = new Date(e.fechaFin + 'T00:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.toISOString().slice(0, 10);
          if (iso === e.fecha) continue;
          if (!map[iso]) map[iso] = [];
          if (!map[iso].find(x => x.id === e.id)) map[iso].push(e);
        }
      }
    }
    return map;
  }, [eventosFiltrados]);

  // Días con eventos, ordenados, para la vista agenda
  const diasConEventos = useMemo(() => {
    return Object.keys(porDia).sort();
  }, [porDia]);

  const grid     = buildGrid(anio, mes);
  const todayIso = isoDay(today.getFullYear(), today.getMonth() + 1, today.getDate());

  function prevMes() {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
  }
  function nextMes() {
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
  }

  const MAX_CHIPS = 3;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: 'var(--bg)' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
              Eventos Cercanos
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
              Maratones · Conciertos · Partidos · Cierres de calles
            </p>
          </div>

          {/* Toggle vista — solo visible en móvil */}
          <div className="flex sm:hidden rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            {(['agenda', 'calendario'] as const).map(v => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className="px-3 py-2 flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                style={vista === v
                  ? { background: 'var(--text)', color: 'var(--bg)' }
                  : { background: 'var(--card)', color: 'var(--text-3)' }
                }
              >
                {v === 'agenda' ? <List className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro local */}
        <select
          value={localSel}
          onChange={e => setLocalSel(e.target.value)}
          className="rounded-xl px-3 py-2 text-[13px] font-medium border focus:outline-none"
          style={{ background: 'var(--card)', color: 'var(--text)', borderColor: 'var(--border)' }}
        >
          <option value="">Todos los locales</option>
          {locales.map(l => (
            <option key={l} value={l}>{SUCURSAL_CONFIG[l]?.label ?? l}</option>
          ))}
        </select>
      </div>

      {/* ── Navegador de mes (compartido) ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={prevMes}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:opacity-70"
          style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>
            {MESES[mes - 1]} {anio}
          </h2>
          {loading && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--hover)', color: 'var(--text-3)' }}>
              cargando…
            </span>
          )}
          {!loading && eventosFiltrados.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--hover)', color: 'var(--text-3)' }}>
              {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={nextMes}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:opacity-70"
          style={{ background: 'var(--card)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA AGENDA — móvil por defecto, también disponible en desktop
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={clsx(vista === 'agenda' ? 'block' : 'hidden', 'sm:hidden')}>
        {!loading && diasConEventos.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-3)' }}>
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">Sin eventos de alto impacto este mes</p>
          </div>
        )}

        <div className="space-y-3">
          {diasConEventos.map(iso => {
            const [y, m, d] = iso.split('-').map(Number);
            const evs      = porDia[iso] ?? [];
            const isToday  = iso === todayIso;
            const esPasado = iso < todayIso;

            return (
              <div
                key={iso}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  opacity: esPasado ? 0.6 : 1,
                }}
              >
                {/* Encabezado de día */}
                <div
                  className="flex items-center gap-2 px-4 py-2.5 border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-[14px] flex-shrink-0"
                    style={isToday
                      ? { background: '#2563EB', color: '#fff' }
                      : { background: 'var(--hover)', color: 'var(--text)' }
                    }
                  >
                    {d}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                      {diaNombreCorto(y, m, d)} {d} de {MESES[m - 1]}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {evs.length} evento{evs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Lista de eventos del día */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {evs.map(ev => {
                    const cfg        = getCatCfg(ev.categoria, ev.etiquetas);
                    const impactColor = ev.impacto >= 70 ? '#DC2626' : ev.impacto >= 40 ? '#D97706' : '#059669';

                    return (
                      <button
                        key={ev.id}
                        onClick={() => setModalEvento(ev)}
                        className="w-full text-left px-4 py-3 flex items-start gap-3 active:opacity-70 transition-opacity"
                      >
                        {/* Ícono de categoría */}
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                          style={{ background: cfg.bg }}
                        >
                          {cfg.emoji}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>
                            {ev.titulo}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            {ev.localesCercanos.slice(0, 3).map(l => {
                              const sc = SUCURSAL_CONFIG[l];
                              return (
                                <span
                                  key={l}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                  style={{ background: sc?.colorLight ?? '#F3F4F6', color: sc?.color ?? '#6B7280' }}
                                >
                                  {sc?.label ?? l}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Impacto */}
                        <div
                          className="text-[11px] font-black px-2 py-1 rounded-lg flex-shrink-0"
                          style={{ color: impactColor, background: impactColor + '15' }}
                        >
                          {ev.impacto}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          VISTA CALENDARIO — siempre visible en desktop, opcional en móvil
      ══════════════════════════════════════════════════════════════════════ */}
      <div className={clsx(vista === 'calendario' ? 'block' : 'hidden', 'sm:block')}>
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

          {/* Encabezados de días */}
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {DIAS.map(d => (
              <div
                key={d}
                className="py-2 text-center text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--text-3)' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grilla de días */}
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const iso     = day ? isoDay(anio, mes, day) : '';
              const evs     = day ? (porDia[iso] ?? []) : [];
              const isToday = iso === todayIso;
              const visible = evs.slice(0, MAX_CHIPS);
              const extra   = evs.length - MAX_CHIPS;
              const isLastRow = i >= grid.length - 7;

              return (
                <div
                  key={i}
                  className="min-h-[88px] sm:min-h-[110px] p-1.5 sm:p-2 flex flex-col gap-0.5"
                  style={{
                    borderRight:  (i + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                    borderBottom: isLastRow ? 'none' : '1px solid var(--border)',
                    opacity: day ? 1 : 0.25,
                  }}
                >
                  {day && (
                    <>
                      <span
                        className="self-start text-[11px] sm:text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full mb-0.5 flex-shrink-0"
                        style={isToday
                          ? { background: '#2563EB', color: '#fff' }
                          : { color: 'var(--text-2)' }
                        }
                      >
                        {day}
                      </span>

                      {visible.map(ev => {
                        const cfg = getCatCfg(ev.categoria, ev.etiquetas);
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setModalEvento(ev)}
                            className="w-full text-left text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate leading-tight transition-opacity hover:opacity-75"
                            style={{ background: cfg.bg, color: cfg.color }}
                            title={ev.titulo}
                          >
                            {cfg.emoji} {ev.titulo}
                          </button>
                        );
                      })}

                      {extra > 0 && (
                        <button
                          onClick={() => setModalDia({ day, lista: evs })}
                          className="text-left text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md transition-opacity hover:opacity-75"
                          style={{ color: 'var(--text-3)' }}
                        >
                          +{extra} más
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Leyenda ─────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[...Object.values(CAT_CONFIG), ...EXTRA_CATS].map((cfg, i) => (
          <span
            key={i}
            className="text-[10px] font-medium px-2 py-1 rounded-full"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.emoji} {cfg.label}
          </span>
        ))}
      </div>

      {/* ── Modal: detalle de evento ──────────────────────────────────────────── */}
      {modalEvento && (
        <EventoModal evento={modalEvento} onClose={() => setModalEvento(null)} />
      )}

      {/* ── Modal: "+N más" eventos del día ───────────────────────────────────── */}
      {modalDia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setModalDia(null)}
        >
          <div
            className="rounded-2xl shadow-xl w-full max-w-sm p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                Eventos — día {modalDia.day}
              </h3>
              <button onClick={() => setModalDia(null)} style={{ color: 'var(--text-3)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {modalDia.lista.map(ev => {
                const cfg = getCatCfg(ev.categoria, ev.etiquetas);
                return (
                  <button
                    key={ev.id}
                    onClick={() => { setModalDia(null); setModalEvento(ev); }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-semibold transition-opacity hover:opacity-75"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.emoji} {ev.titulo}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal detalle ─────────────────────────────────────────────────────────────

function EventoModal({ evento, onClose }: { evento: EventoClient; onClose: () => void }) {
  const cfg = getCatCfg(evento.categoria, evento.etiquetas);
  const impactLabel = evento.impacto >= 70 ? 'Alto' : evento.impacto >= 40 ? 'Medio' : 'Bajo';
  const impactColor = evento.impacto >= 70 ? '#DC2626' : evento.impacto >= 40 ? '#D97706' : '#059669';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: cfg.bg }}
            >
              {cfg.emoji}
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
              <h3 className="text-[15px] font-bold leading-tight mt-0.5" style={{ color: 'var(--text)' }}>
                {evento.titulo}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: 'var(--text-3)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
            <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {evento.fecha}
              {evento.fechaFin && evento.fechaFin !== evento.fecha ? ` → ${evento.fechaFin}` : ''}
            </span>
          </div>

          {evento.localesCercanos.length > 0 && (
            <div className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--text-2)' }}>
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {evento.localesCercanos.map(l => {
                  const sc = SUCURSAL_CONFIG[l];
                  return (
                    <span
                      key={l}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: sc?.colorLight ?? '#F3F4F6', color: sc?.color ?? '#6B7280' }}
                    >
                      {sc?.label ?? l}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {evento.impacto > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>Impacto estimado:</span>
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ color: impactColor, background: impactColor + '20' }}
              >
                {impactLabel} · {evento.impacto}/100
              </span>
            </div>
          )}

          {evento.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {evento.etiquetas.map(tag => (
                <span
                  key={tag}
                  className="text-[9px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--hover)', color: 'var(--text-3)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {evento.url && (
            <a
              href={evento.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-medium text-blue-500 hover:underline pt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver detalles
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
