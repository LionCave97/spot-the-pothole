import type { PhotoModerationActionResponse, PhotoModerationRejectRequest } from '@shared/types'
import { requireModerator } from '../../../../utils/moderator'
import { rejectModerationPhoto } from '../../../../utils/photoModeration'

export default defineEventHandler(async (event): Promise<PhotoModerationActionResponse> => {
  const moderatorId = await requireModerator(event)
  const reportId = getRouterParam(event, 'reportId')
  if (!reportId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing report id' })
  }

  const body = await readBody<PhotoModerationRejectRequest>(event)
  if (!body?.reason) {
    throw createError({ statusCode: 400, statusMessage: 'Rejection reason required' })
  }

  const supabase = useServerSupabase(event)
  await rejectModerationPhoto(supabase, moderatorId, reportId, body.reason)

  return {
    report_id: reportId,
    photo_moderation_status: 'rejected',
    published_photo_path: null,
  }
})
