'use client';

/**
 * Acceso al asistente virtual — solo se muestra si el usuario logueado es
 * admin. getClientSession() lee una cookie no-httpOnly pensada solo para
 * pistas de UI (ver session-client.ts); la autorización real la hace el
 * endpoint /api/asistente/chat.
 *
 * Es un botón chico y fijo arriba a la derecha, centrado verticalmente en el
 * header navy de marca (el Header reserva ese espacio con padding derecho).
 * Navy con aro blanco translúcido: sobre el header se lee como un botón
 * "ghost", y en páginas sin header sigue siendo visible sobre fondo claro.
 * El panel de chat se abre debajo, alineado a su borde derecho.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { getClientSession } from '@/lib/session-client';
import AsistenteChat, { type Mensaje } from './AsistenteChat';

type ChatView = 'closed' | 'panel' | 'immersive';

// AsistenteChat calcula la posición del panel suponiendo una burbuja de 56px
// en `anchor` (left/top). Se le pasa un ancla "virtual" de ese tamaño cuya
// esquina inferior derecha coincide con la del botón real, así el panel abre
// justo debajo y alineado a la derecha.
const PANEL_ANCHOR_SIZE = 56;

interface Pos { x: number; y: number }

export default function AsistenteBubble() {
  const [esAdmin, setEsAdmin] = useState(false);
  const [vista, setVista] = useState<ChatView>('closed');
  const [anchor, setAnchor] = useState<Pos | null>(null);
  // La conversación vive acá, no en AsistenteChat: este componente no se
  // desmonta al cerrar el panel, así que cerrar y volver a abrir mantiene el
  // historial. Se pierde recién con un reload real o con el basurero.
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState('');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const medirAncla = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.right - PANEL_ANCHOR_SIZE, y: r.bottom - PANEL_ANCHOR_SIZE });
  }, []);

  useEffect(() => {
    // La cookie de sesión solo existe en el cliente: leerla en el render
    // rompería la hidratación, por eso se lee acá una vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEsAdmin(getClientSession()?.role === 'admin');
  }, []);

  useEffect(() => {
    if (vista === 'closed') return;
    window.addEventListener('resize', medirAncla);
    return () => window.removeEventListener('resize', medirAncla);
  }, [vista, medirAncla]);

  useEffect(() => {
    if (vista === 'closed' && restoreFocus.current) {
      buttonRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [vista]);

  const toggle = useCallback(() => {
    medirAncla();
    setVista(v => (v === 'closed' ? 'panel' : 'closed'));
  }, [medirAncla]);

  const closeChat = useCallback(() => {
    restoreFocus.current = true;
    setVista('closed');
  }, []);

  if (!esAdmin) return null;

  const abierto = vista !== 'closed';

  return (
    <>
      {abierto && anchor && (
        <AsistenteChat
          view={vista}
          onClose={closeChat}
          onEnterImmersive={() => setVista('immersive')}
          onMinimize={() => setVista('panel')}
          anchor={anchor}
          mensajes={mensajes}
          setMensajes={setMensajes}
          input={borrador}
          setInput={setBorrador}
        />
      )}
      {vista !== 'immersive' && (
        <button
          ref={buttonRef}
          onClick={toggle}
          aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente'}
          aria-expanded={abierto}
          title="Asistente"
          className="fixed z-50 top-3 right-3 sm:top-[18px] sm:right-6 w-9 h-9 rounded-full flex items-center justify-center ring-1 transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2"
          style={abierto
            ? { background: '#ffffff', color: 'var(--brand-navy)', ['--tw-ring-color' as string]: 'rgba(255,255,255,0.9)' }
            : { background: 'var(--brand-navy)', color: '#ffffff', ['--tw-ring-color' as string]: 'rgba(255,255,255,0.35)' }}
        >
          {abierto
            ? <X className="w-4 h-4" strokeWidth={2} />
            : <MessageCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />}
        </button>
      )}
    </>
  );
}
