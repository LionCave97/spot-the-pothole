import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

const migrationPath = path.resolve(
  import.meta.dirname,
  '../../supabase/migrations/20260101000003_spot_photos_storage.sql',
)

test('spot-photos migration defines expected RLS shape', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8')
  assert.match(sql, /insert into storage\.buckets/i)
  assert.match(sql, /bucket_id = 'spot-photos'/i)
  assert.match(sql, /\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i)
})
