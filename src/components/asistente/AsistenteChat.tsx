'use client';

/**
 * Panel de chat del asistente virtual. Historial efímero: vive en el estado
 * de este componente, se pierde si se cierra/recarga la página a propósito
 * (ver spec — no hay persistencia en esta primera versión).
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, X } from 'lucide-react';

interface Mensaje {
  role: 'user' | 'assistant';
  content: string;
}

export default function AsistenteChat({ onClose }: { onClose: () => void }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
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
          className="w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
