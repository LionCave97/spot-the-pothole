import type { SpotReportRequest, SpotReportResponse } from '@shared/types'
import { POTHOL_MERGE_RADIUS_METERS } from '@shared/constants'
import { ingestQuarantineSpotPhoto } from '../../utils/spotPhotoQuarantine'
import { mapSubmitSpotResult } from '../../utils/mapSubmitSpotResult'

export default defineEventHandler(async (event): Promise<SpotReportResponse> => {
  const userId = await requireUserId(event)
  const body = await readBody<SpotReportRequest>(event)

  if (!body?.lat || !body?.lng || !body?.name || !body?.photo_path) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const expectedPrefix = `${userId}/`
  if (!body.photo_path.startsWith(expectedPrefix) || body.photo_path.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'photo_path must be a quarantine path under your user folder' })
  }

  const supabase = useServerSupabase(event)

  const ingest = await ingestQuarantineSpotPhoto(supabase, userId, body.photo_path)

  const { data: lookup } = await supabase.rpc('lookup_ward_and_authority', {
    p_lat: body.lat,
    p_lng: body.lng,
  })

  const wardRow = Array.isArray(lookup) ? lookup[0] : lookup

  const { data: submitRows, error: submitErr } = await supabase.rpc('submit_spot', {
    p_reporter_id: userId,
    p_lat: body.lat,
    p_lng: body.lng,
    p_name: body.name,
    p_photo_path: body.photo_path,
    p_photo_moderation_status: ingest.moderationStatus,
    p_published_photo_path: ingest.publishedPhotoPath,
    p_road_ref: body.road_ref ?? null,
    p_ward_id: wardRow?.ward_id ?? null,
    p_authority: wardRow?.authority ?? null,
    p_radius_m: POTHOL_MERGE_RADIUS_METERS,
  })

  if (submitErr) {
    throw createError({ statusCode: 500, statusMessage: submitErr.message })
  }

  const row = Array.isArray(submitRows) ? submitRows[0] : submitRows
  if (!row?.pothole_id || !row?.report_id) {
    throw createError({ statusCode: 500, statusMessage: 'submit_spot returned no row' })
  }

  return mapSubmitSpotResult(row, ingest, wardRow)
})
