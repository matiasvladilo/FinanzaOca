'use client';

/**
 * Burbuja flotante del asistente virtual — solo se muestra si el usuario
 * logueado es admin. getClientSession() lee una cookie no-httpOnly pensada
 * solo para pistas de UI (ver session-client.ts); la autorización real la
 * hace el endpoint /api/asistente/chat.
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getClientSession } from '@/lib/session-client';
import AsistenteChat from './AsistenteChat';

export default function AsistenteBubble() {
  const [esAdmin, setEsAdmin] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [esOscuro, setEsOscuro] = useState(false);

  useEffect(() => {
    setEsAdmin(getClientSession()?.role === 'admin');
    setEsOscuro(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  }, []);

  if (!esAdmin) return null;

  return (
    <>
      {abierto && <AsistenteChat onClose={() => setAbierto(false)} />}
      <button
        onClick={() => setAbierto(o => !o)}
        aria-label="Abrir asistente"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl overflow-hidden border-2 border-white hover:scale-105 transition-transform"
      >
        <Image
          src={esOscuro ? '/assistant/agente-oscuro.png' : '/assistant/agente-claro.png'}
          alt="Asistente"
          width={56}
          height={56}
          className="w-full h-full object-cover"
        />
      </button>
    </>
  );
}
