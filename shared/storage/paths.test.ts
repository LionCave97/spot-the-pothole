import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSpotPhotoStoragePath } from './paths.ts'

test('builds user-scoped storage path', () => {
  assert.equal(
    buildSpotPhotoStoragePath('11111111-1111-1111-1111-111111111111', '2026-01-01T12-00-00Z.jpg'),
    '11111111-1111-1111-1111-111111111111/2026-01-01T12-00-00Z.jpg',
  )
})

test('rejects path traversal in file name', () => {
  assert.throws(() => buildSpotPhotoStoragePath('user', '../secret.jpg'))
})
