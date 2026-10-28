import type { H3Event } from 'h3'
import { createClient } from '@supabase/supabase-js'

export function useServerSupabase(event?: H3Event) {
  const config = useRuntimeConfig(event)
  const url = config.public.supabaseUrl
  const key = config.supabaseServiceRoleKey

  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Supabase service role is not configured. Set SUPABASE_SERVICE_ROLE_KEY in web/.env (never use the anon key on the server).',
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
