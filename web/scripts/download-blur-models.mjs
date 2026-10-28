#!/usr/bin/env node
/**
 * Download OpenCV Zoo ONNX models into server/assets (pinned SHA-256).
 * Patches input height/width to dynamic dims so onnxruntime-node matches OpenCV DNN.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../server/assets/blur-models')

const FACE_URL =
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx'
const PLATE_URL =
  'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/license_plate_detection_yunet/license_plate_detection_lpd_yunet_2023mar.onnx'

const CHECKSUMS = {
  'face_detection_yunet_2023mar.onnx':
    '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4',
  'license_plate_detection_lpd_yunet_2023mar.onnx':
    '6d4978a7b6d25514d5e24811b82bfb511d166bdd8ca3b03aa63c1623d4d039c7',
}

async function download(url, dest, expectedSha) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const sha = createHash('sha256').update(buf).digest('hex')
  if (sha !== expectedSha) {
    throw new Error(`Checksum mismatch for ${dest}: expected ${expectedSha}, got ${sha}`)
  }
  await writeFile(dest, buf)
  console.log(`Wrote ${dest}`)
}

function patchDynamicOnnx(srcPath, destPath) {
  execFileSync(
    'python3',
    [
      '-c',
      `
import onnx
m = onnx.load(${JSON.stringify(srcPath)})
inp = m.graph.input[0]
dims = inp.type.tensor_type.shape.dim
dims[2].ClearField('dim_value'); dims[2].dim_param = 'height'
dims[3].ClearField('dim_value'); dims[3].dim_param = 'width'
onnx.save(m, ${JSON.stringify(destPath)})
`,
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const tmpDir = join(OUT_DIR, '.tmp')
  await mkdir(tmpDir, { recursive: true })

  for (const [name, sha] of Object.entries(CHECKSUMS)) {
    const url = name.startsWith('face') ? FACE_URL : PLATE_URL
    const raw = join(tmpDir, name)
    await download(url, raw, sha)
    patchDynamicOnnx(raw, join(OUT_DIR, name))
  }

  const notice = `# Blur ONNX models (OpenCV Zoo)

Downloaded at build/dev time via \`npm run blur:models\`. Not committed (see .gitignore).
Licenses: YuNet MIT, LPD-YuNet Apache-2.0 (see worker/MODELS.md).
`
  await writeFile(join(OUT_DIR, 'README.md'), notice)
  console.log('Models ready in', OUT_DIR)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
