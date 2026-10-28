import type { H3Event } from 'h3'
import { useServerSupabase, requireUserId } from './supabase'

export async function requireModerator(event: H3Event): Promise<string> {
  const userId = await requireUserId(event)
  const supabase = useServerSupabase(event)

  const { data, error } = await supabase
    .from('profiles')
    .select('is_moderator')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.is_moderator) {
    throw createError({ statusCode: 403, statusMessage: 'Moderator access required' })
  }

  return userId
}
