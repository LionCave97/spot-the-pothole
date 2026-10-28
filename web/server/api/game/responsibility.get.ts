import type { ResponsibilityLookupResponse } from '@shared/types'

export default defineEventHandler(async (event): Promise<ResponsibilityLookupResponse> => {
  const query = getQuery(event)
  const lat = Number(query.lat)
  const lng = Number(query.lng)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw createError({ statusCode: 400, statusMessage: 'lat and lng query params required' })
  }

  const supabase = useServerSupabase(event)
  const { data, error } = await supabase.rpc('lookup_ward_and_authority', {
    p_lat: lat,
    p_lng: lng,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    ward_id: row?.ward_id ?? null,
    ward_name: row?.ward_name ?? null,
    authority: row?.authority ?? null,
    road_ref: null,
  }
})
