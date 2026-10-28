#!/usr/bin/env node
import { createJiti } from 'jiti'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB = join(__dirname, '..')
const ROOT = join(WEB, '..')
const jiti = createJiti(import.meta.url, { interopDefault: true })

const { detectRegions } = jiti('../server/lib/blur/detectRegions')
const { decodeToBgr } = jiti('../server/lib/blur/imageBgr')

const FIXTURES = join(ROOT, 'fixtures/blur-worker-eval')
const MANIFEST = join(FIXTURES, 'manifest.json')
const IMAGES = join(FIXTURES, 'images')
const FACE_MIN = 0.55
const PLATE_MIN = 0.55

function countDetections(detections, label, minScore) {
  return detections.filter(d => d.label === label && d.score >= minScore).length
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1)
  return sorted[idx]
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  const latencies = []
  const rows = []
  const skipped = []

  for (const entry of manifest.images) {
    const imgPath = join(IMAGES, `${entry.id}.jpg`)
    let bytes
    try {
      bytes = await readFile(imgPath)
    }
    catch {
      skipped.push(entry.id)
      continue
    }
    const { bgr, width, height } = await decodeToBgr(bytes)
    const t0 = performance.now()
    const detections = await detectRegions(bgr, width, height)
    latencies.push(performance.now() - t0)
    rows.push({
      id: entry.id,
      category: entry.category,
      expectedFaces: entry.expectedFaceCount ?? 0,
      detectedFaces: countDetections(detections, 'face', FACE_MIN),
      expectedPlates: entry.expectedPlateCount ?? 0,
      detectedPlates: countDetections(detections, 'plate', PLATE_MIN),
      latencyMs: Math.round(latencies.at(-1) * 10) / 10,
    })
  }

  const sorted = [...latencies].sort((a, b) => a - b)
  console.log(JSON.stringify({
    summary: {
      imagesEvaluated: rows.length,
      imagesSkippedMissing: skipped.length,
      latencyMsMedian: sorted.length ? Math.round(percentile(sorted, 0.5) * 10) / 10 : null,
      latencyMsP95: sorted.length ? Math.round(percentile(sorted, 0.95) * 10) / 10 : null,
      peakRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    perImage: rows,
    skippedIds: skipped,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
