#!/usr/bin/env node
/** Unit test: TS nmsBoxes vs cv2 (cases built at test time). */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const jiti = createJiti(import.meta.url)
const { nmsBoxes } = jiti('../server/lib/blur/nms.ts')

function loadCases() {
  const provider = join(__dirname, 'nms-golden-provider.py')
  const raw = execFileSync('python3', [provider], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(raw)
}

async function main() {
  const cases = loadCases()
  if (cases.length < 3) {
    console.error('Need blur models and optional eval fixtures for full NMS golden coverage.')
    process.exit(2)
  }
  let failed = 0
  for (const c of cases) {
    const got = nmsBoxes(c.boxes, c.scores, c.score_threshold, c.nms_threshold, c.top_k)
    try {
      assert.deepEqual(got, c.indices, c.name)
      console.log('ok', c.name, got.length)
    }
    catch {
      failed++
      console.error('FAIL', c.name)
      console.error(' expected', c.indices)
      console.error(' got     ', got)
    }
  }
  if (failed) process.exit(1)
  console.log(`All ${cases.length} golden NMS cases passed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
