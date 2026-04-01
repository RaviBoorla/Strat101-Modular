import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL  ?? '') as string;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;

// Log a clear warning in the console instead of throwing —
// throwing at module-load time crashes the entire React app before it mounts,
// producing a blank page with no visible error.
if (!url || !key) {
  console.error(
    '[Strat101] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Check your Vercel environment variables and redeploy.'
  );
}

export const supabase: SupabaseClient = createClient(
  url  || 'https://placeholder.supabase.co',
  key  || 'placeholder-key',
  {
    auth: {
      persistSession:   true,
      autoRefreshToken: true,
      storageKey:       'strat101-auth',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);
