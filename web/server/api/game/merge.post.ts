import type { MergeDuplicatesRequest } from '@shared/types'

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  const body = await readBody<MergeDuplicatesRequest>(event)
  const radius = body?.radius_m ?? 15

  if (body?.lat === undefined || body?.lng === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'lat/lng required' })
  }

  const supabase = useServerSupabase(event)
  const { data, error } = await supabase.rpc('find_nearby_pothole', {
    p_lat: body.lat,
    p_lng: body.lng,
    p_radius_m: radius,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { nearby_pothole_id: data ?? null, radius_m: radius }
})
