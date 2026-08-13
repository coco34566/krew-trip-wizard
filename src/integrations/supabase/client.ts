// Supabase client for the Vite frontend.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createMockSupabaseClient() {
  console.error('[Supabase Client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  const mockQueryBuilder = {
    select: () => mockQueryBuilder, insert: () => mockQueryBuilder, update: () => mockQueryBuilder,
    delete: () => mockQueryBuilder, eq: () => mockQueryBuilder, neq: () => mockQueryBuilder,
    gt: () => mockQueryBuilder, lt: () => mockQueryBuilder, gte: () => mockQueryBuilder,
    lte: () => mockQueryBuilder, like: () => mockQueryBuilder, ilike: () => mockQueryBuilder,
    in: () => mockQueryBuilder, order: () => mockQueryBuilder, limit: () => mockQueryBuilder,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => mockQueryBuilder,
    rpc: async () => ({ data: null, error: null }),
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }), download: async () => ({ data: null, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  } as any;
}

function createSupabaseClient() {
  // Vercel environment variables used by KREW's frontend.
  const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return createMockSupabaseClient();

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { fetch: createSupabaseFetch(supabaseAnonKey) },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
