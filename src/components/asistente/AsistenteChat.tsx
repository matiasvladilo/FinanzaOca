'use client';

/**
 * Panel de chat del asistente virtual. Historial efímero pero NO por
 * componente: los mensajes viven en el estado de AsistenteBubble (el padre,
 * que no se desmonta al cerrar el panel), así que cerrar y volver a abrir
 * mantiene la conversación. Recargar la página sí la borra — es memoria de
 * React, no hay persistencia en disco/localStorage a propósito (ver spec).
 * El único borrado explícito es el botón de basurero.
 *
 * La burbuja se puede arrastrar a cualquier parte de la pantalla (ver
 * AsistenteBubble), así que este panel ya no puede vivir fijo en
 * bottom-24/right-6 — se ancla dinámicamente cerca de donde esté la burbuja
 * en ese momento, abriendo para el lado que tenga espacio.
 */

import { useState, useRef, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { Maximize2, Minimize2, MoreHorizontal, Send, X } from 'lucide-react';

export interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
}

const PANEL_W = 360;
const PANEL_H = 520;
const GAP = 12;     // separación entre la burbuja y el panel
const MARGIN = 8;   // margen mínimo contra los bordes del viewport

// Transcripción de sólo lo visible (sin metadata ni marcas de tiempo
// inventadas), en orden cronológico — es lo que termina en el portapapeles.
function formatearTranscripcion(mensajes: Mensaje[]): string {
  return mensajes
    .map(m => `${m.role === 'user' ? 'Tú' : 'OCAI'}: ${m.content}`)
    .join('\n\n');
}

function calcularPosicionPanel(anchor: { x: number; y: number }, bubbleSize: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Si la burbuja está en la mitad inferior de la pantalla, el panel abre
  // hacia arriba; si no, hacia abajo. Mismo criterio en horizontal.
  const abreArriba = anchor.y + bubbleSize / 2 > vh / 2;
  const abreIzquierda = anchor.x + bubbleSize / 2 > vw / 2;

  let top = abreArriba ? anchor.y - GAP - PANEL_H : anchor.y + bubbleSize + GAP;
  let left = abreIzquierda ? anchor.x + bubbleSize - PANEL_W : anchor.x;

  top = Math.min(Math.max(top, MARGIN), vh - PANEL_H - MARGIN);
  left = Math.min(Math.max(left, MARGIN), vw - PANEL_W - MARGIN);

  return { top, left };
}

export default function AsistenteChat({
  view, onClose, onEnterImmersive, onMinimize, anchor, mensajes, setMensajes, input, setInput,
}: {
  view: 'panel' | 'immersive';
  onClose: () => void;
  onEnterImmersive: () => void;
  onMinimize: () => void;
  anchor: { x: number; y: number };
  mensajes: Mensaje[];
  setMensajes: Dispatch<SetStateAction<Mensaje[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
}) {
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [confirmandoNuevaConversacion, setConfirmandoNuevaConversacion] = useState(false);
  const [estadoAnuncio, setEstadoAnuncio] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const maximizeRef = useRef<HTMLButtonElement>(null);
  const previousViewRef = useRef(view);

  // Recalcula si la burbuja se movió (arrastre) o si la ventana cambió de
  // tamaño mientras el panel estaba abierto.
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const actualizar = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    actualizar();
    window.addEventListener('resize', actualizar);
    return () => window.removeEventListener('resize', actualizar);
  }, []);
  const posicion = useMemo(
    () => (viewport.w ? calcularPosicionPanel(anchor, 56) : { top: 0, left: 0 }),
    [anchor, viewport],
  );

  useEffect(() => {
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (view === 'immersive') {
      dialogRef.current?.focus();
    } else if (previousViewRef.current === 'immersive') {
      maximizeRef.current?.focus();
    }
    previousViewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (view !== 'immersive') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMinimize();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, onMinimize]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || cargando) return;
    const nuevos: Mensaje[] = [...mensajes, { role: 'user', content: texto }];
    setMensajes(nuevos);
    setInput('');
    setCargando(true);
    try {
      const res = await fetch('/api/asistente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nuevos }),
      });
      const data = await res.json();
      const reply = data.ok ? data.reply : 'No pude consultar los datos ahora, probá de nuevo en un momento.';
      setMensajes(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMensajes(m => [...m, { role: 'assistant', content: 'No pude consultar los datos ahora, probá de nuevo en un momento.' }]);
    } finally {
      setCargando(false);
    }
  }

  function iniciarNuevaConversacion() {
    setMenuAbierto(false);
    setConfirmandoNuevaConversacion(true);
  }

  function confirmarNuevaConversacion() {
    setMensajes([]);
    setInput('');
    setConfirmandoNuevaConversacion(false);
  }

  async function compartirChat() {
    setMenuAbierto(false);
    try {
      await navigator.clipboard.writeText(formatearTranscripcion(mensajes));
      setEstadoAnuncio('Conversación copiada');
    } catch {
      setEstadoAnuncio('No pude copiar la conversación');
    }
  }

  const controlClass = 'min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

  return (
    <div
      ref={dialogRef}
      role={view === 'immersive' ? 'dialog' : undefined}
      aria-modal={view === 'immersive' ? true : undefined}
      aria-labelledby={view === 'immersive' ? 'asistente-chat-title' : undefined}
      tabIndex={view === 'immersive' ? -1 : undefined}
      className={view === 'immersive'
        ? 'fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-950'
        : 'fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[70vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden'}
      style={view === 'panel' ? { top: posicion.top, left: posicion.left } : undefined}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <p id="asistente-chat-title" className="text-[13px] font-bold text-gray-900 dark:text-gray-100">OCAI · Asistente FinanzasOca</p>
        <div className="flex items-center gap-1">
          {view === 'panel' ? (
            <button ref={maximizeRef} onClick={onEnterImmersive} aria-label="Modo inmersivo (pantalla completa)" title="Modo inmersivo" className={`${controlClass} gap-1 px-2 text-[12px] font-medium`}>
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /> Modo inmersivo
            </button>
          ) : (
            <button onClick={onMinimize} aria-label="Minimizar" title="Minimizar" className={`${controlClass} gap-1 px-2 text-[12px] font-medium`}>
              <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" /> Minimizar
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAbierto(abierto => !abierto)}
              aria-label="Más acciones de OCAI"
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
              title="Más acciones de OCAI"
              className={controlClass}
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>
            {menuAbierto && (
              <div role="menu" aria-label="Acciones de OCAI" className="absolute right-0 top-full z-10 mt-1 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <button type="button" role="menuitem" onClick={iniciarNuevaConversacion} className="min-h-11 w-full rounded-lg px-3 text-left text-[13px] text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100 dark:hover:bg-gray-800">
                  Nueva conversación
                </button>
                <button type="button" role="menuitem" onClick={compartirChat} className="min-h-11 w-full rounded-lg px-3 text-left text-[13px] text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-100 dark:hover:bg-gray-800">
                  Compartir chat
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar" className={controlClass}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {cargando ? 'OCAI está preparando una respuesta.' : estadoAnuncio}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {mensajes.length === 0 && (
          <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center mt-8">
            Preguntame sobre ventas, gastos, merma, producción o proveedores.
            <br />Ej.: &ldquo;¿Cuánto gastó La Reina en agosto?&rdquo;
          </p>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 text-gray-400 rounded-2xl px-3 py-2 text-[13px]">
              Pensando…
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
          placeholder="Escribí tu pregunta…"
          disabled={cargando}
          className="flex-1 text-[13px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-full px-3.5 py-2 outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        <button
          onClick={enviar}
          disabled={cargando || !input.trim()}
          aria-label="Enviar mensaje"
          title="Enviar mensaje"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {confirmandoNuevaConversacion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="nueva-conversacion-title" aria-describedby="nueva-conversacion-description" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <h2 id="nueva-conversacion-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">Nueva conversación</h2>
            <p id="nueva-conversacion-description" className="mt-2 text-sm text-gray-600 dark:text-gray-300">Se eliminarán los mensajes y el borrador actual.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmandoNuevaConversacion(false)} className="min-h-11 rounded-lg px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-200 dark:hover:bg-gray-800">Cancelar</button>
              <button type="button" onClick={confirmarNuevaConversacion} aria-label="Confirmar nueva conversación" className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900">Nueva conversación</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
