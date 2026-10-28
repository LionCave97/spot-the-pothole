import type { PhotoModerationQueueResponse } from '@shared/types'
import { requireModerator } from '../../../utils/moderator'
import { listPhotoModerationQueue } from '../../../utils/photoModeration'

export default defineEventHandler(async (event): Promise<PhotoModerationQueueResponse> => {
  await requireModerator(event)
  const supabase = useServerSupabase(event)
  return listPhotoModerationQueue(supabase)
})
