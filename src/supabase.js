import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        storageKey: 'henalytics-auth',
        persistSession: true,
        // Explicit rather than relying on defaults. autoRefreshToken keeps
        // the access token fresh while the app is awake; on mobile /
        // Capacitor the webview is suspended when backgrounded, so the
        // refresh timer can't fire on schedule — HomesteadApp's
        // visibilitychange handler calls getSession() on resume to force a
        // revalidation then. Pinning these here also guards against a future
        // supabase-js version changing a default underneath us.
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    })
  : null;
