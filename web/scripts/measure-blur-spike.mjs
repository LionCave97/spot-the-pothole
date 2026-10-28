#!/usr/bin/env node
/** Bundle size, cold-start, and eval latency for the Vercel blur spike. */
import { createJiti } from 'jiti'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WEB = join(__dirname, '..')
const ROOT = join(WEB, '..')
const jiti = createJiti(import.meta.url, { interopDefault: true })

async function dirSizeBytes(dir) {
  let total = 0
  async function walk(p) {
    const entries = await readdir(p, { withFileTypes: true })
    for (const e of entries) {
      const fp = join(p, e.name)
      if (e.isDirectory()) await walk(fp)
      else total += (await stat(fp)).size
    }
  }
  await walk(dir)
  return total
}

async function measureBundle() {
  execFileSync('npm', ['run', 'blur:models'], { cwd: WEB, stdio: 'inherit' })
  execFileSync('npm', ['run', 'build'], {
    cwd: WEB,
    stdio: 'inherit',
    env: { ...process.env, NITRO_PRESET: 'vercel' },
  })
  const vercelFnDir = join(WEB, '.vercel/output/functions')
  const fnBytes = await dirSizeBytes(vercelFnDir).catch(() => 0)
  const outDir = join(WEB, '.output')
  const total = await dirSizeBytes(outDir).catch(() => 0)
  return {
    vercelFunctionsDirBytes: fnBytes,
    vercelFunctionsDirMb: Math.round(fnBytes / 1024 / 1024 * 10) / 10,
    nitroOutputDirMb: Math.round(total / 1024 / 1024 * 10) / 10,
    under250MbLimit: fnBytes > 0 && fnBytes < 250 * 1024 * 1024,
    note: 'Vercel Hobby/Pro standard limit: 250 MB unzipped per serverless function (.vercel/output/functions)',
  }
}

async function measureColdStartAndLatency() {
  const { detectRegions } = jiti('../server/lib/blur/detectRegions')
  const { decodeToBgr } = jiti('../server/lib/blur/imageBgr')
  const { resetOnnxSessions } = jiti('../server/lib/blur/onnxSessions')

  const sample = await readFile(join(ROOT, 'fixtures/blur-worker-eval/images/plate-gauteng-bmw.jpg'))
  const { bgr, width, height } = await decodeToBgr(sample)

  await resetOnnxSessions()
  const cold0 = performance.now()
  await detectRegions(bgr, width, height)
  const coldMs = performance.now() - cold0

  const { ensureBlurOnnxSessions } = jiti('../server/lib/blur/onnxSessions')
  await ensureBlurOnnxSessions()

  const warm = []
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now()
    await detectRegions(bgr, width, height)
    warm.push(performance.now() - t0)
  }

  const manifest = JSON.parse(await readFile(join(ROOT, 'fixtures/blur-worker-eval/manifest.json'), 'utf8'))
  const latencies = []
  let peakRss = process.memoryUsage().rss
  for (const entry of manifest.images) {
    try {
      const bytes = await readFile(join(ROOT, 'fixtures/blur-worker-eval/images', `${entry.id}.jpg`))
      const decoded = await decodeToBgr(bytes)
      const t0 = performance.now()
      await detectRegions(decoded.bgr, decoded.width, decoded.height)
      latencies.push(performance.now() - t0)
      peakRss = Math.max(peakRss, process.memoryUsage().rss)
    }
    catch {
      // missing image
    }
  }
  latencies.sort((a, b) => a - b)
  const p = q => latencies[Math.max(0, Math.ceil(latencies.length * q) - 1)]

  return {
    coldStartMs: Math.round(coldMs),
    warmMedianMs: Math.round(warm.sort((a, b) => a - b)[2]),
    fixtureLatencyMedianMs: Math.round(p(0.5)),
    fixtureLatencyP95Ms: Math.round(p(0.95)),
    peakRssMb: Math.round(peakRss / 1024 / 1024),
  }
}

async function main() {
  const bundle = await measureBundle()
  const runtime = await measureColdStartAndLatency()
  console.log(JSON.stringify({ bundle, runtime }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
