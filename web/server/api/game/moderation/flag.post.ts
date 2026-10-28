import type { ModerationFlagReason } from '@shared/types'

interface FlagBody {
  target_type: 'pothole' | 'comment' | 'report'
  target_id: string
  reason: ModerationFlagReason
  details?: string
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await readBody<FlagBody>(event)

  if (!body?.target_type || !body?.target_id || !body?.reason) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const supabase = useServerSupabase(event)
  const { data, error } = await supabase
    .from('moderation_flags')
    .insert({
      target_type: body.target_type,
      target_id: body.target_id,
      reporter_id: userId,
      reason: body.reason,
      details: body.details ?? null,
    })
    .select('id')
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { flag_id: data.id, status: 'queued' }
})
