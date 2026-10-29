import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function useSupabaseClient() {
  const config = useRuntimeConfig()

  if (import.meta.server) {
    return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  }

  if (!browserClient) {
    browserClient = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}
