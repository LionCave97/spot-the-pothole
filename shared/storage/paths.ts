export const SPOT_PHOTOS_QUARANTINE_BUCKET = 'spot-photos-quarantine'
export const SPOT_PHOTOS_PUBLISHED_BUCKET = 'spot-photos'

export function buildSpotPhotoStoragePath(userId: string, fileName: string): string {
  if (!userId || userId.includes('/') || userId.includes('..')) {
    throw new Error('Invalid user id for storage path')
  }
  if (!fileName || fileName.includes('/') || fileName.includes('..')) {
    throw new Error('Invalid file name for storage path')
  }
  return `${userId}/${fileName}`
}

export function spotPhotoObjectUrl(supabaseUrl: string, storagePath: string): string {
  const base = supabaseUrl.replace(/\/$/, '')
  return `${base}/storage/v1/object/public/${SPOT_PHOTOS_PUBLISHED_BUCKET}/${storagePath}`
}

/** @deprecated use SPOT_PHOTOS_PUBLISHED_BUCKET */
export const SPOT_PHOTOS_BUCKET_ID = SPOT_PHOTOS_PUBLISHED_BUCKET
