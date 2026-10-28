import { createJiti } from 'jiti'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const jiti = createJiti(import.meta.url)
const {
  PHOTO_BLUR_MAX_ATTEMPTS,
  PHOTO_BLUR_LOCK_MS,
  computeBackoffSeconds,
  decideClaimWithoutRpc,
  shouldRetryFailure,
} = jiti('./claim.ts')

describe('decideClaimWithoutRpc', () => {
  const base = {
    id: 'r1',
    photo_moderation_status: 'pending',
    published_photo_path: null,
    photo_blur_attempt_count: 0,
    photo_blur_processing_at: null,
  }

  it('skips published reports', () => {
    const d = decideClaimWithoutRpc(
      { ...base, photo_moderation_status: 'published', published_photo_path: 'u/x.jpg' },
      Date.now(),
    )
    assert.equal(d.action, 'skip')
  })

  it('waits while lock is fresh', () => {
    const now = Date.now()
    const d = decideClaimWithoutRpc(
      { ...base, photo_blur_processing_at: new Date(now - 1000).toISOString() },
      now,
      PHOTO_BLUR_LOCK_MS,
    )
    assert.equal(d.action, 'wait')
  })

  it('allows reclaim after lock expires', () => {
    const now = Date.now()
    const d = decideClaimWithoutRpc(
      { ...base, photo_blur_processing_at: new Date(now - PHOTO_BLUR_LOCK_MS - 1).toISOString() },
      now,
    )
    assert.equal(d.action, 'claim')
  })

  it('stops after max attempts', () => {
    const d = decideClaimWithoutRpc(
      { ...base, photo_blur_attempt_count: PHOTO_BLUR_MAX_ATTEMPTS },
      Date.now(),
    )
    assert.equal(d.reason, 'max_attempts_exceeded')
  })
})

describe('shouldRetryFailure', () => {
  it('does not retry after max attempts', () => {
    assert.equal(shouldRetryFailure('error', PHOTO_BLUR_MAX_ATTEMPTS), false)
  })

  it('retries transient errors under cap', () => {
    assert.equal(shouldRetryFailure('upload_failed', 2), true)
  })
})

describe('computeBackoffSeconds', () => {
  it('caps backoff', () => {
    assert.ok(computeBackoffSeconds(10) <= 3600)
  })
})
