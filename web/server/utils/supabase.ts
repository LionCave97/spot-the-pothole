import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'

export function useServerSupabase(event?: H3Event) {
  const config = useRuntimeConfig(event)
  const url = config.public.supabaseUrl
  const key = config.supabaseServiceRoleKey || config.public.supabaseAnonKey

  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase is not configured. Copy web/.env.example to web/.env.',
    })
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireUserId(event: H3Event): Promise<string> {
  const authHeader = getHeader(event, 'authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Missing bearer token' })
  }

  const supabase = useServerSupabase(event)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }
  return data.user.id
}
