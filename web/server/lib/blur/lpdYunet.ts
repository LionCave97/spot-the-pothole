import { Tensor } from 'onnxruntime-web'
import { blobFromImageBgr } from './blobFromImage'
import { resizeBgrMatchCv2 } from './imageBgr'
import { nmsBoxesLpdCorners } from './nms'
import { pyInt } from './pyInt'
import type { Detection } from './types'
import type { OrtSession } from './onnxSessions'

const MIN_SIZES = [[10, 16, 24], [32, 48], [64, 96], [128, 192, 256]] as const
const STEPS = [8, 16, 32, 64] as const
const VARIANCE = [0.1, 0.2] as const

export class LpdYunet {
  private inputW = 320
  private inputH = 240
  private priors: Float32Array = new Float32Array(0)
  private readonly confThreshold: number
  private readonly nmsThreshold: number
  private readonly topK: number
  private readonly keepTopK: number

  constructor(
    private readonly session: OrtSession,
    {
      confThreshold = 0.55,
      nmsThreshold = 0.3,
      topK = 5000,
      keepTopK = 750,
    }: {
      confThreshold?: number
      nmsThreshold?: number
      topK?: number
      keepTopK?: number
    } = {},
  ) {
    this.confThreshold = confThreshold
    this.nmsThreshold = nmsThreshold
    this.topK = topK
    this.keepTopK = keepTopK
    this.regeneratePriors()
  }

  setInputSize(width: number, height: number): void {
    this.inputW = width
    this.inputH = height
    this.regeneratePriors()
  }

  private regeneratePriors(): void {
    const w = this.inputW
    const h = this.inputH
    const featureMap2 = [Math.floor(Math.floor((h + 1) / 2) / 2), Math.floor(Math.floor((w + 1) / 2) / 2)]
    const featureMap3 = [Math.floor(featureMap2[0] / 2), Math.floor(featureMap2[1] / 2)]
    const featureMap4 = [Math.floor(featureMap3[0] / 2), Math.floor(featureMap3[1] / 2)]
    const featureMap5 = [Math.floor(featureMap4[0] / 2), Math.floor(featureMap4[1] / 2)]
    const featureMap6 = [Math.floor(featureMap5[0] / 2), Math.floor(featureMap5[1] / 2)]
    const featureMaps = [featureMap3, featureMap4, featureMap5, featureMap6]

    const priors: number[] = []
    for (let k = 0; k < featureMaps.length; k++) {
      const [fh, fw] = featureMaps[k]
      const minSizes = MIN_SIZES[k]
      for (let i = 0; i < fh; i++) {
        for (let j = 0; j < fw; j++) {
          for (const minSize of minSizes) {
            const sKx = minSize / w
            const sKy = minSize / h
            const cx = (j + 0.5) * STEPS[k] / w
            const cy = (i + 0.5) * STEPS[k] / h
            priors.push(cx, cy, sKx, sKy)
          }
        }
      }
    }
    this.priors = new Float32Array(priors)
  }

  async infer(bgr: Uint8Array, width: number, height: number): Promise<Float32Array[]> {
    if (width !== this.inputW || height !== this.inputH) {
      throw new Error(`LPD input size mismatch: image ${width}x${height}, expected ${this.inputW}x${this.inputH}`)
    }
    const blob = blobFromImageBgr(bgr, width, height, width, height)
    const input = new Tensor('float32', blob, [1, 3, height, width])
    const out = await sessionRun(this.session, input)
    return this.decode(out)
  }

  private decode(out: { loc: Float32Array, conf: Float32Array, iou: Float32Array }): Float32Array[] {
    const { loc, conf, iou } = out
    const n = this.priors.length / 4
    const scale = [this.inputW, this.inputH]
    const dets: number[][] = []

    for (let i = 0; i < n; i++) {
      let iouScore = iou[i]
      if (iouScore < 0) iouScore = 0
      else if (iouScore > 1) iouScore = 1
      const clsScore = conf[i * 2 + 1]
      const score = Math.sqrt(clsScore * iouScore)
      const px = this.priors[i * 4]
      const py = this.priors[i * 4 + 1]
      const pw = this.priors[i * 4 + 2]
      const ph = this.priors[i * 4 + 3]
      const li = i * 14
      const corners = [
        (px + loc[li + 4] * VARIANCE[0] * pw) * scale[0],
        (py + loc[li + 5] * VARIANCE[0] * ph) * scale[1],
        (px + loc[li + 6] * VARIANCE[0] * pw) * scale[0],
        (py + loc[li + 7] * VARIANCE[0] * ph) * scale[1],
        (px + loc[li + 10] * VARIANCE[0] * pw) * scale[0],
        (py + loc[li + 11] * VARIANCE[0] * ph) * scale[1],
        (px + loc[li + 12] * VARIANCE[0] * pw) * scale[0],
        (py + loc[li + 13] * VARIANCE[0] * ph) * scale[1],
      ]
      dets.push([...corners, score])
    }

    const boxes = dets.map(d => [d[0], d[1], d[2], d[3]])
    const scores = dets.map(d => d[8])
    const keep = nmsBoxesLpdCorners(boxes, scores, this.confThreshold, this.nmsThreshold, this.topK)
    return keep.slice(0, this.keepTopK).map(idx => new Float32Array(dets[idx]))
  }
}

async function sessionRun(
  session: OrtSession,
  input: Tensor,
): Promise<{ loc: Float32Array, conf: Float32Array, iou: Float32Array }> {
  const result = await session.run({ input })
  return {
    loc: result.loc.data as Float32Array,
    conf: result.conf.data as Float32Array,
    iou: result.iou.data as Float32Array,
  }
}

export function quadToAabb(row: Float32Array): { x: number, y: number, w: number, h: number, score: number } {
  const xs = [row[0], row[2], row[4], row[6]]
  const ys = [row[1], row[3], row[5], row[7]]
  const score = row[8]
  const x0 = pyInt(Math.min(...xs))
  const y0 = pyInt(Math.min(...ys))
  const x1 = pyInt(Math.max(...xs))
  const y1 = pyInt(Math.max(...ys))
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), score }
}

export async function detectPlatesPass(
  lpd: LpdYunet,
  bgr: Uint8Array,
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<Detection[]> {
  const targetW = Math.max(320, pyInt(width * scale))
  const targetH = Math.max(240, pyInt(height * scale))
  const resized =
    targetW === width && targetH === height
      ? bgr
      : await resizeBgrMatchCv2(bgr, width, height, targetW, targetH)
  lpd.setInputSize(targetW, targetH)
  const rows = await lpd.infer(resized, targetW, targetH)
  const inv = scale === 1 ? 1 : 1 / scale
  const out: Detection[] = []
  for (const row of rows) {
    const { x, y, w, h, score } = quadToAabb(row)
    out.push({
      x: pyInt(x * inv + offsetX),
      y: pyInt(y * inv + offsetY),
      w: Math.max(1, pyInt(w * inv)),
      h: Math.max(1, pyInt(h * inv)),
      score,
      label: 'plate',
    })
  }
  return out
}
