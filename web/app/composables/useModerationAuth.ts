import type { Session } from '@supabase/supabase-js'

export function useModerationAuth() {
  async function authHeaders(session: Session | null): Promise<HeadersInit> {
    if (!session?.access_token) {
      throw new Error('Sign in required')
    }
    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  return { authHeaders }
}
