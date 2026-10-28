import type { ScoreLeaderboardEntry } from '@shared/types'

export default defineEventHandler(async (): Promise<ScoreLeaderboardEntry[]> => {
  // Stub until Supabase is wired in CI without secrets
  return [
    {
      user_id: '00000000-0000-0000-0000-000000000001',
      username: 'demo_spotter',
      is_anonymous: false,
      points: 10,
      rank: 1,
    },
  ]
})
