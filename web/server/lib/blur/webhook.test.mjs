import { createJiti } from 'jiti'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const jiti = createJiti(import.meta.url)
const { parseReportWebhook, parseStorageWebhook, verifyWebhookSecret } = jiti('./webhook.ts')

describe('verifyWebhookSecret', () => {
  it('accepts header and bearer', () => {
    assert.equal(verifyWebhookSecret('s', 's'), true)
    assert.equal(verifyWebhookSecret(null, 's', 'Bearer s'), true)
    assert.equal(verifyWebhookSecret('bad', 's'), false)
  })
})

describe('parseStorageWebhook', () => {
  it('parses quarantine insert', () => {
    const ev = parseStorageWebhook({
      type: 'INSERT',
      record: { bucket_id: 'spot-photos-quarantine', name: 'uid/a.jpg' },
    })
    assert.equal(ev?.object_path, 'uid/a.jpg')
  })
})

describe('parseReportWebhook', () => {
  it('parses pending report', () => {
    const ev = parseReportWebhook({
      record: {
        id: 'uuid',
        photo_path: 'uid/a.jpg',
        photo_moderation_status: 'pending',
        published_photo_path: null,
      },
    })
    assert.equal(ev?.report_id, 'uuid')
  })
})
