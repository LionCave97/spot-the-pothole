import type { SupabaseClient } from '@supabase/supabase-js'
import type { PhotoModerationStatus } from '../../../shared/media/constants.ts'

const SPOT_PHOTOS_QUARANTINE_BUCKET = 'spot-photos-quarantine'
const SPOT_PHOTOS_PUBLISHED_BUCKET = 'spot-photos'

export interface QuarantineIngestResult {
  moderationStatus: PhotoModerationStatus
  publishedPhotoPath: string | null
}

/**
 * Phase 1: verify quarantine object and leave report in pending moderation.
 * Server-side blur + copy to spot-photos is implemented via service role in a follow-up job.
 */
export async function ingestQuarantineSpotPhoto(
  supabase: SupabaseClient,
  userId: string,
  quarantinePath: string,
): Promise<QuarantineIngestResult> {
  const expectedPrefix = `${userId}/`
  if (!quarantinePath.startsWith(expectedPrefix) || quarantinePath.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid quarantine photo path' })
  }

  const { data, error } = await supabase.storage
    .from(SPOT_PHOTOS_QUARANTINE_BUCKET)
    .download(quarantinePath)

  if (error || !data) {
    throw createError({ statusCode: 400, statusMessage: 'Quarantine photo not found' })
  }

  // Placeholder for server-side vision blur. Phase 1 holds moderation pending instead of publishing.
  void data

  return {
    moderationStatus: 'pending',
    publishedPhotoPath: null,
  }
}

/**
 * Service-role only: publish a moderated photo to the public bucket (future moderation worker).
 */
export async function publishSpotPhotoToPublicBucket(
  supabase: SupabaseClient,
  userId: string,
  quarantinePath: string,
  blurredBytes: Blob,
): Promise<string> {
  const fileName = quarantinePath.split('/').pop() || `${Date.now()}.jpg`
  const publishedPath = `${userId}/${fileName}`

  const { error: uploadErr } = await supabase.storage
    .from(SPOT_PHOTOS_PUBLISHED_BUCKET)
    .upload(publishedPath, blurredBytes, { contentType: 'image/jpeg', upsert: false })

  if (uploadErr) {
    throw createError({ statusCode: 500, statusMessage: uploadErr.message })
  }

  return publishedPath
}
