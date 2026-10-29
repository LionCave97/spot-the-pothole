import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** Resolve bundled ONNX paths (dev + Nitro serverAssets). */
export function resolveBlurModelPaths(): { face: string, plate: string } {
  const candidates = [
    join(__dirname, '../../assets/blur-models'),
    join(process.cwd(), 'server/assets/blur-models'),
    join(process.cwd(), '.output/server/assets/blur-models'),
  ]
  for (const dir of candidates) {
    const face = join(dir, 'face_detection_yunet_2023mar.onnx')
    const plate = join(dir, 'license_plate_detection_lpd_yunet_2023mar.onnx')
    if (existsSync(face) && existsSync(plate)) {
      return { face, plate }
    }
  }
  throw new Error(
    'Blur ONNX models not found. Run `cd web && npm run blur:models` before build or dev.',
  )
}
