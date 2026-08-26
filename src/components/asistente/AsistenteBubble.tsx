'use client';

/**
 * Burbuja flotante del asistente virtual — solo se muestra si el usuario
 * logueado es admin. getClientSession() lee una cookie no-httpOnly pensada
 * solo para pistas de UI (ver session-client.ts); la autorización real la
 * hace el endpoint /api/asistente/chat.
 *
 * Se puede arrastrar a cualquier lugar de la pantalla (algunos gráficos
 * quedaban tapados con la posición fija de siempre en la esquina). La
 * posición se guarda en localStorage para que no vuelva a la esquina en
 * cada recarga.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { getClientSession } from '@/lib/session-client';
import AsistenteChat, { type Mensaje } from './AsistenteChat';

const BUBBLE_SIZE = 56; // w-14 h-14
const EDGE_MARGIN = 24; // separación inicial de los bordes (igual al bottom-6/right-6 de antes)
const VIEWPORT_MARGIN = 8; // margen mínimo permitido contra cualquier borde al arrastrar
const STORAGE_KEY = 'asistente-bubble-pos';
const DRAG_THRESHOLD = 6; // px de movimiento — por debajo de esto es un click, no un arrastre

interface Pos { x: number; y: number } // left/top en px, no bottom/right

function clamp(pos: Pos): Pos {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - BUBBLE_SIZE - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - BUBBLE_SIZE - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, VIEWPORT_MARGIN), maxY),
  };
}

function posicionPorDefecto(): Pos {
  return {
    x: window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN,
    y: window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN,
  };
}

export default function AsistenteBubble() {
  const [esAdmin, setEsAdmin] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [esOscuro, setEsOscuro] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  // La conversación vive acá, no en AsistenteChat: este componente no se
  // desmonta al cerrar el panel (solo cambia `abierto`), así que cerrar y
  // volver a abrir mantiene el historial. Se pierde recién con un reload
  // real de la página (memoria de React) o con el botón de basurero.
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  // Estado del arrastre en refs — no necesitan re-render por sí mismos, solo
  // la posición (pos) sí. wasDragged sobrevive un tick extra porque el click
  // nativo del botón se dispara DESPUÉS del pointerup, y hay que descartarlo
  // ahí si lo que pasó fue un arrastre, no un click real.
  const dragRef = useRef<{ startPointer: Pos; startPos: Pos; moved: number } | null>(null);
  const wasDragged = useRef(false);

  useEffect(() => {
    setEsAdmin(getClientSession()?.role === 'admin');

    // El tema real de la app no es el de preferencia del SO — el usuario lo
    // puede fijar a mano (claro/oscuro/dracula) vía el toggle del header,
    // guardado en localStorage y aplicado como clase en <html> (ver
    // ThemeProvider). Leer matchMedia acá quedaría desincronizado del tema
    // que el usuario realmente eligió, y nunca detectaría "dracula" (que
    // globals.css trata igual que "dark"). Nos fijamos directo en la clase
    // real de <html>, con un observer para que la burbuja siga el cambio de
    // tema sin necesitar recargar la página.
    const root = document.documentElement;
    const actualizarTema = () => setEsOscuro(root.classList.contains('dark') || root.classList.contains('dracula'));
    actualizarTema();
    const observer = new MutationObserver(actualizarTema);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    // Posición inicial: la última que el usuario dejó, re-clampeada por si
    // la guardó en una pantalla más grande y ahora es más chica (o al revés).
    let inicial: Pos;
    try {
      const guardada = localStorage.getItem(STORAGE_KEY);
      inicial = guardada ? clamp(JSON.parse(guardada) as Pos) : posicionPorDefecto();
    } catch {
      inicial = posicionPorDefecto();
    }
    setPos(inicial);

    const onResize = () => setPos(p => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startPointer: { x: e.clientX, y: e.clientY }, startPos: pos, moved: 0 };
    wasDragged.current = false;
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startPointer.x;
    const dy = e.clientY - drag.startPointer.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx), Math.abs(dy));
    if (drag.moved > DRAG_THRESHOLD) {
      wasDragged.current = true;
      setPos(clamp({ x: drag.startPos.x + dx, y: drag.startPos.y + dy }));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (wasDragged.current) {
      // Fue un arrastre real — persistir la posición final. El click nativo
      // que el navegador dispara después del pointerup lo descarta
      // handleClick de abajo (mira wasDragged).
      setPos(p => {
        if (p) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* localStorage no disponible, no es crítico */ }
        }
        return p;
      });
    }
  }, []);

  const handleClick = useCallback(() => {
    if (wasDragged.current) {
      wasDragged.current = false; // consumido — el próximo click sí cuenta
      return;
    }
    setAbierto(o => !o);
  }, []);

  if (!esAdmin) return null;

  return (
    <>
      {abierto && pos && (
        <AsistenteChat
          onClose={() => setAbierto(false)}
          anchor={pos}
          mensajes={mensajes}
          setMensajes={setMensajes}
        />
      )}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleClick}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente (se puede arrastrar)'}
        title="Arrastrame para moverme"
        className="fixed z-50 w-14 h-14 rounded-full shadow-xl overflow-hidden border-2 border-white hover:scale-105 transition-transform touch-none select-none cursor-grab active:cursor-grabbing"
        style={pos ? { left: pos.x, top: pos.y } : { right: EDGE_MARGIN, bottom: EDGE_MARGIN }}
      >
        <Image
          src={esOscuro ? '/assistant/agente-oscuro.png' : '/assistant/agente-claro.png'}
          alt="Asistente"
          width={56}
          height={56}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </button>
    </>
  );
}
