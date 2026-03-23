/**
 * supabase-profiles.ts
 * Cliente Supabase para la tabla user_profiles (FinanzasOca user emails).
 * Proyecto: https://zwbizinovubfpkwkljdv.supabase.co
 *
 * Variables requeridas en .env.local:
 *   USER_PROFILES_SUPABASE_URL=https://zwbizinovubfpkwkljdv.supabase.co
 *   USER_PROFILES_SUPABASE_KEY=<secret key>
 *
 * ⚠️  NUNCA importar este módulo desde archivos 'use client'.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getProfilesClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.USER_PROFILES_SUPABASE_URL;
  const key = process.env.USER_PROFILES_SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase-profiles] Variables de entorno no configuradas: ' +
      'USER_PROFILES_SUPABASE_URL y USER_PROFILES_SUPABASE_KEY deben estar en .env.local'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
