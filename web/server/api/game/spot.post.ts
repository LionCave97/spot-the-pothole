import type { SpotReportRequest, SpotReportResponse } from '@shared/types'

export default defineEventHandler(async (event): Promise<SpotReportResponse> => {
  const userId = await requireUserId(event)
  const body = await readBody<SpotReportRequest>(event)

  if (!body?.lat || !body?.lng || !body?.name || !body?.photo_path) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const expectedPrefix = `${userId}/`
  if (!body.photo_path.startsWith(expectedPrefix) || body.photo_path.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'photo_path must live under your user folder' })
  }

  const blurVerified = getHeader(event, 'x-spot-blur-verified')
  if (blurVerified !== 'on-device') {
    throw createError({
      statusCode: 422,
      statusMessage: 'On-device privacy blur required before spot submission',
    })
  }

  const supabase = useServerSupabase(event)

  const { data: lookup } = await supabase.rpc('lookup_ward_and_authority', {
    p_lat: body.lat,
    p_lng: body.lng,
  })

  const wardRow = Array.isArray(lookup) ? lookup[0] : lookup

  const { data: pothole, error: potholeErr } = await supabase
    .from('potholes')
    .insert({
      name: body.name,
      location: `POINT(${body.lng} ${body.lat})`,
      road_ref: body.road_ref ?? null,
      authority: wardRow?.authority ?? null,
      ward_id: wardRow?.ward_id ?? null,
      photo_path: body.photo_path,
    })
    .select('id')
    .single()

  if (potholeErr || !pothole) {
    throw createError({ statusCode: 500, statusMessage: potholeErr?.message || 'Insert failed' })
  }

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .insert({
      pothole_id: pothole.id,
      reporter_id: userId,
      photo_path: body.photo_path,
      location: `POINT(${body.lng} ${body.lat})`,
    })
    .select('id')
    .single()

  if (reportErr || !report) {
    throw createError({ statusCode: 500, statusMessage: reportErr?.message || 'Report failed' })
  }

  const { data: mergedId, error: mergeErr } = await supabase.rpc('merge_report_into_pothole', {
    p_report_id: report.id,
    p_radius_m: 15,
  })

  if (mergeErr) {
    throw createError({ statusCode: 500, statusMessage: mergeErr.message })
  }

  const finalId = (mergedId as string) || pothole.id
  const merged = finalId !== pothole.id

  return {
    pothole_id: finalId,
    report_id: report.id,
    merged,
    ward_id: wardRow?.ward_id ?? null,
    authority: wardRow?.authority ?? null,
    points_awarded: 0,
  }
})
