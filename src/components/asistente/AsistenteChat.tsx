'use client';

/**
 * Panel de chat del asistente virtual. Historial efímero: vive en el estado
 * de este componente, se pierde si se cierra/recarga la página a propósito
 * (ver spec — no hay persistencia en esta primera versión).
 *
 * La burbuja ahora se puede arrastrar a cualquier parte de la pantalla (ver
 * AsistenteBubble), así que este panel ya no puede vivir fijo en
 * bottom-24/right-6 — se ancla dinámicamente cerca de donde esté la burbuja
 * en ese momento, abriendo para el lado que tenga espacio.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Trash2, X } from 'lucide-react';

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
}

const PANEL_W = 360;
const PANEL_H = 520;
const GAP = 12;     // separación entre la burbuja y el panel
const MARGIN = 8;   // margen mínimo contra los bordes del viewport

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

export default function AsistenteChat({ onClose, anchor }: { onClose: () => void; anchor: { x: number; y: number } }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, cargando]);

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

  return (
    <div
      className="fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      style={{ top: posicion.top, left: posicion.left }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-[13px] font-bold text-gray-900">Asistente FinanzasOca</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMensajes([])}
            title="Limpiar conversación"
            className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {mensajes.length === 0 && (
          <p className="text-[12px] text-gray-400 text-center mt-8">
            Preguntame sobre ventas, gastos, merma, producción o proveedores.
            <br />Ej.: &ldquo;¿Cuánto gastó La Reina en agosto?&rdquo;
          </p>
        )}
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 rounded-2xl px-3 py-2 text-[13px]">
              Pensando…
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') enviar(); }}
          placeholder="Escribí tu pregunta…"
          disabled={cargando}
          className="flex-1 text-[13px] border border-gray-200 rounded-full px-3.5 py-2 outline-none focus:border-blue-400"
        />
        <button
          onClick={enviar}
          disabled={cargando || !input.trim()}
          aria-label="Enviar mensaje"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
