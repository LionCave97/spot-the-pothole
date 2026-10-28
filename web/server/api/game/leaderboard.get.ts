import type { ScoreLeaderboardEntry } from '@shared/types'

export default defineEventHandler(async (event): Promise<ScoreLeaderboardEntry[]> => {
  const supabase = useServerSupabase(event)

  const { data, error } = await supabase
    .from('profiles_public')
    .select('username,is_anonymous,points')
    .order('points', { ascending: false })
    .limit(50)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).map((row, index) => ({
    username: row.is_anonymous ? 'Anonymous' : row.username,
    is_anonymous: row.is_anonymous,
    points: row.points,
    rank: index + 1,
  }))
})
