/**
 * supabase-controlpan.ts
 * Cliente Supabase para el sistema de Control de Pan (proyecto separado).
 *
 * Proyecto: https://hofhgqkitfmjobqqhacp.supabase.co
 * Sistema:  https://controlpanoca.netlify.app
 *
 * Variables requeridas en .env.local:
 *   CONTROLPAN_SUPABASE_URL=https://hofhgqkitfmjobqqhacp.supabase.co
 *   CONTROLPAN_SUPABASE_KEY=<anon-key>
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getControlPanClient(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.CONTROLPAN_SUPABASE_URL;
  const key = process.env.CONTROLPAN_SUPABASE_KEY;

  if (!url || !key) return null;

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}
