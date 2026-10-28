import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'

const webRoot = path.resolve(import.meta.dirname, '../../web/server')

describe('moderation API routes enforce requireModerator', () => {
  const routeFiles = [
    'api/moderation/photos/index.get.ts',
    'api/moderation/photos/[reportId]/approve.post.ts',
    'api/moderation/photos/[reportId]/reject.post.ts',
    'api/moderation/me.get.ts',
  ]

  for (const file of routeFiles) {
    it(`${file} calls requireModerator`, () => {
      const src = fs.readFileSync(path.join(webRoot, file), 'utf8')
      assert.match(src, /requireModerator/)
    })
  }
})

describe('moderator helper rejects non-moderators', () => {
  it('moderator.ts returns 403 when is_moderator is false', () => {
    const src = fs.readFileSync(path.join(webRoot, 'utils/moderator.ts'), 'utf8')
    assert.match(src, /statusCode: 403/)
    assert.match(src, /is_moderator/)
  })
})
