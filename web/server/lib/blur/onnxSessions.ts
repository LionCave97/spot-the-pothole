import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ort from 'onnxruntime-web'
import { resolveBlurModelPaths } from './modelPaths'

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveOrtWasmDir(): string {
  const candidates = [
    join(__dirname, '../../../node_modules/onnxruntime-web/dist'),
    join(process.cwd(), 'node_modules/onnxruntime-web/dist'),
    join(process.cwd(), '.output/server/node_modules/onnxruntime-web/dist'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'ort-wasm-simd.wasm')) || existsSync(join(dir, 'ort-wasm-simd-threaded.wasm'))) {
      return dir.endsWith('/') ? dir : `${dir}/`
    }
  }
  return join(__dirname, '../../../node_modules/onnxruntime-web/dist/').replace(/\/?$/, '/')
}

ort.env.wasm.numThreads = 1
ort.env.wasm.simd = true
ort.env.wasm.wasmPaths = resolveOrtWasmDir()

let faceSession: ort.InferenceSession | null = null
let plateSession: ort.InferenceSession | null = null
let sessionsReady: Promise<void> | null = null

async function loadModel(path: string): Promise<ort.InferenceSession> {
  const bytes = await readFile(path)
  return ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
}

/** Load face + plate ONNX sessions once per instance (parallel). */
export function ensureBlurOnnxSessions(): Promise<void> {
  if (!sessionsReady) {
    sessionsReady = (async () => {
      const { face, plate } = resolveBlurModelPaths()
      const [faceS, plateS] = await Promise.all([loadModel(face), loadModel(plate)])
      faceSession = faceS
      plateSession = plateS
    })()
  }
  return sessionsReady
}

export async function getFaceSession(): Promise<ort.InferenceSession> {
  await ensureBlurOnnxSessions()
  if (!faceSession) throw new Error('Face ONNX session failed to load')
  return faceSession
}

export async function getPlateSession(): Promise<ort.InferenceSession> {
  await ensureBlurOnnxSessions()
  if (!plateSession) throw new Error('Plate ONNX session failed to load')
  return plateSession
}

/** Drop cached sessions (cold-start measurement only). */
export async function resetOnnxSessions(): Promise<void> {
  faceSession = null
  plateSession = null
  sessionsReady = null
}

export type OrtSession = ort.InferenceSession
export type OrtTensor = ort.Tensor
