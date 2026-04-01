import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL  as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
    'check your .env.local file and Vercel environment variables.'
  );
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true,
    storageKey:       'strat101-auth',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
