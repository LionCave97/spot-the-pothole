#!/usr/bin/env node
/** Compare TS detection counts to committed baseline (no worker dependency). */
import { createJiti } from 'jiti'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB = join(__dirname, '..')
const ROOT = join(WEB, '..')
const jiti = createJiti(import.meta.url, { interopDefault: true })

const BASELINE = join(ROOT, 'fixtures/blur-worker-eval/detection-counts-baseline.json')
const FIXTURES = join(ROOT, 'fixtures/blur-worker-eval')
const IMAGES = join(FIXTURES, 'images')

const { detectRegions } = jiti('../server/lib/blur/detectRegions')
const { decodeToBgr } = jiti('../server/lib/blur/imageBgr')
const { ensureBlurOnnxSessions } = jiti('../server/lib/blur/onnxSessions')

await ensureBlurOnnxSessions()

const baseline = JSON.parse(await readFile(BASELINE, 'utf8'))
const faceMin = baseline.faceMinScore ?? 0.55
const plateMin = baseline.plateMinScore ?? 0.55

function counts(detections) {
  return {
    faces: detections.filter(d => d.label === 'face' && d.score >= faceMin).length,
    plates: detections.filter(d => d.label === 'plate' && d.score >= plateMin).length,
  }
}

const mismatches = []
let compared = 0
let matches = 0

for (const [id, expected] of Object.entries(baseline.images)) {
  let bytes
  try {
    bytes = await readFile(join(IMAGES, `${id}.jpg`))
  }
  catch {
    continue
  }
  compared++
  const { bgr, width, height } = await decodeToBgr(bytes)
  const ts = counts(await detectRegions(bgr, width, height))
  const same = ts.faces === expected.faces && ts.plates === expected.plates
  if (same) matches++
  else mismatches.push({ id, expected, typescript: ts })
}

const report = { imagesCompared: compared, exactMatches: matches, mismatches }
console.log(JSON.stringify(report, null, 2))
await writeFile(join(ROOT, 'docs/blur-detection-compare.json'), JSON.stringify(report, null, 2))

if (mismatches.length) process.exit(1)
