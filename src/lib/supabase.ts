/**
 * supabase.ts
 * Cliente Supabase para uso EXCLUSIVO en server-side (API routes, Server Components).
 *
 * Las variables de entorno NO tienen prefijo NEXT_PUBLIC_ para que nunca
 * queden expuestas en el bundle del navegador.
 *
 * Variables requeridas en .env.local:
 *   SUPABASE_URL=https://<tu-proyecto>.supabase.co
 *   SUPABASE_ANON_KEY=<tu-anon-key>
 *
 * ⚠️  NUNCA importar este módulo desde archivos 'use client'.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Retorna el cliente Supabase (singleton).
 * Lanza un error claro si las env vars no están configuradas.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  // Preferir service_role (bypasea RLS) — es seguro porque este módulo es server-only
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase] Variables de entorno no configuradas: SUPABASE_URL y ' +
      'SUPABASE_SERVICE_ROLE_KEY deben estar definidas en .env.local'
    );
  }

  _client = createClient(url, key, {
    auth: {
      // No persistir sesión — acceso puro de analytics, no auth de usuarios
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _client;
}
