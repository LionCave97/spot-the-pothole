import type {
  PhotoModerationActionResponse,
  PhotoModerationApproveRequest,
  NormalizedBlurRegion,
} from '@shared/types'
import { validateBlurRegions } from '../../../../../../shared/moderation/blur-regions.ts'
import { requireModerator } from '../../../../utils/moderator'
import { approveModerationPhoto } from '../../../../utils/photoModeration'

export default defineEventHandler(async (event): Promise<PhotoModerationActionResponse> => {
  const moderatorId = await requireModerator(event)
  const reportId = getRouterParam(event, 'reportId')
  if (!reportId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing report id' })
  }

  const body = await readBody<PhotoModerationApproveRequest>(event)
  const rawRegions = body?.blur_regions
  let regions: NormalizedBlurRegion[] = []
  if (rawRegions !== undefined) {
    const parsed = validateBlurRegions(rawRegions)
    if (parsed === null) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid blur_regions' })
    }
    regions = parsed
  }

  const supabase = useServerSupabase(event)
  const { published_photo_path } = await approveModerationPhoto(
    supabase,
    moderatorId,
    reportId,
    regions,
  )

  return {
    report_id: reportId,
    photo_moderation_status: 'published',
    published_photo_path,
  }
})
