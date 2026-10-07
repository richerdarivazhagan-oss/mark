/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

/** Helper to check if a JWT token payload role is service_role */
function isServiceRoleKey(key: string): boolean {
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      return payload.role === 'service_role';
    }
  } catch {
    /* ignore */
  }
  return false;
}

const hasServiceRoleKey = isServiceRoleKey(supabaseAnonKey);

if (hasServiceRoleKey) {
  console.error(
    '[Supabase Security Alert] A service_role key was detected in VITE_SUPABASE_ANON_KEY. ' +
    'The service_role key must NEVER be exposed in client-side code!'
  );
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project.supabase.co') &&
  !supabaseAnonKey.includes('placeholder') &&
  !hasServiceRoleKey
);

if (!isSupabaseConfigured) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or public VITE_SUPABASE_ANON_KEY environment variables are missing or invalid.'
  );
}

/**
 * Public Supabase client using Supabase Auth and public anon key.
 * Supports session persistence, automatic token refresh, and Auth state listeners.
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
