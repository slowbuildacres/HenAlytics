// Supabase client. Reads keys from environment variables that Vite injects
// at build time. Locally these come from .env.local; on Vercel they come
// from the project's environment variable settings.
//
// Both values are safe to expose in frontend code — the anon key is
// designed for that. The service_role key (which we don't use anywhere)
// is the only secret one.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars are missing (e.g. someone forked this without setting them up),
// we don't crash — auth UI just shows a helpful message instead.
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null;
