import type { ConfirmPotholeRequest, ConfirmPotholeResponse } from '@shared/types'

export default defineEventHandler(async (event): Promise<ConfirmPotholeResponse> => {
  const userId = await requireUserId(event)
  const body = await readBody<ConfirmPotholeRequest>(event)

  if (!body?.pothole_id || body.lat === undefined || body.lng === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const supabase = useServerSupabase(event)

  const { data, error } = await supabase.rpc('record_confirmation', {
    p_pothole_id: body.pothole_id,
    p_confirmer_id: userId,
    p_lat: body.lat,
    p_lng: body.lng,
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    confirmation_id: row?.confirmation_id,
    confirmation_count: row?.confirmation_count ?? 0,
    points_awarded: row?.points_awarded ?? 0,
  }
})
