import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

const migrationPath = path.resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260101000007_photo_moderation_queue.sql',
)

test('photo moderation migration defines moderator flag, audit log, and masked reports_public', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /is_moderator boolean/i)
  assert.match(sql, /photo_moderation_audit_log/i)
  assert.match(sql, /photo_moderation_decision/i)
  assert.match(sql, /published_photo_path/i)
  assert.match(sql, /is_moderator = \(/i)
  assert.match(sql, /revoke insert, update, delete on public\.photo_moderation_audit_log/i)
})
