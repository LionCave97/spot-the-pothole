import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

const migrationPath = path.resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260101000003_spot_photos_storage.sql',
)

test('storage migration defines quarantine upload RLS and public read-only spot-photos', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /spot-photos-quarantine/i)
  assert.match(sql, /bucket_id = 'spot-photos-quarantine'/i)
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i)
  assert.match(sql, /spot-photos-quarantine',\s*\n\s*false/i)
  assert.match(sql, /Published spot photos are publicly readable/i)
  assert.match(sql, /drop policy if exists "Authenticated users upload own spot photos"/i)
  assert.doesNotMatch(sql, /create policy "Authenticated users upload own spot photos"/i)
})
