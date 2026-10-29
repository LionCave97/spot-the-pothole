/** Photo blur queue: claim lock + retry policy (matches DB RPC). */

export const PHOTO_BLUR_MAX_ATTEMPTS = 5
export const PHOTO_BLUR_LOCK_MS = 10 * 60 * 1000

export interface ReportBlurRow {
  id: string
  photo_moderation_status: string
  published_photo_path: string | null
  photo_blur_attempt_count: number
  photo_blur_processing_at: string | null
}

export type ClaimDecision =
  | { action: 'claim' }
  | { action: 'skip'; reason: string }
  | { action: 'wait'; reason: string }

export function decideClaimWithoutRpc(
  report: ReportBlurRow,
  nowMs: number,
  lockMs = PHOTO_BLUR_LOCK_MS,
  maxAttempts = PHOTO_BLUR_MAX_ATTEMPTS,
): ClaimDecision {
  if (report.photo_moderation_status === 'published' && report.published_photo_path) {
    return { action: 'skip', reason: 'already_published' }
  }
  if (report.photo_moderation_status !== 'pending') {
    return { action: 'skip', reason: 'not_pending' }
  }
  if (report.photo_blur_attempt_count >= maxAttempts) {
    return { action: 'skip', reason: 'max_attempts_exceeded' }
  }
  if (report.photo_blur_processing_at) {
    const lockedUntil = Date.parse(report.photo_blur_processing_at) + lockMs
    if (Number.isFinite(lockedUntil) && nowMs < lockedUntil) {
      return { action: 'wait', reason: 'processing_locked' }
    }
  }
  return { action: 'claim' }
}

export function shouldRetryFailure(reason: string, attemptCount: number, maxAttempts = PHOTO_BLUR_MAX_ATTEMPTS): boolean {
  if (reason === 'max_attempts_exceeded') return false
  if (reason === 'already_published' || reason === 'invalid_path' || reason === 'not_pending') return false
  return attemptCount < maxAttempts
}

export function computeBackoffSeconds(attemptCount: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1))
}
