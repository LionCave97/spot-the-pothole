import type { OrtSession } from './onnxSessions'
import { Tensor } from 'onnxruntime-web'
import { blobFromImageBgr, padDims } from './blobFromImage'
import { nmsBoxes } from './nms'
import { pyInt } from './pyInt'
import type { Detection } from './types'

const STRIDES = [8, 16, 32]
const SCORE_THRESHOLD = 0.3
const NMS_THRESHOLD = 0.3
const TOP_K = 5000

const OUTPUT_ORDER = [
  'cls_8',
  'cls_16',
  'cls_32',
  'obj_8',
  'obj_16',
  'obj_32',
  'bbox_8',
  'bbox_16',
  'bbox_32',
  'kps_8',
  'kps_16',
  'kps_32',
]

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export async function detectFacesYunet(
  session: OrtSession,
  bgr: Uint8Array,
  width: number,
  height: number,
): Promise<Detection[]> {
  const { padW, padH } = padDims(width, height, 32)
  const blob = blobFromImageBgr(bgr, width, height, padW, padH)
  const input = new Tensor('float32', blob, [1, 3, padH, padW])
  const outputs = await session.run({ input })

  const faces: { x: number, y: number, w: number, h: number, score: number }[] = []

  for (let i = 0; i < STRIDES.length; i++) {
    const stride = STRIDES[i]
    const cols = Math.floor(padW / stride)
    const rows = Math.floor(padH / stride)
    const cls = outputs[OUTPUT_ORDER[i]].data as Float32Array
    const obj = outputs[OUTPUT_ORDER[i + 3]].data as Float32Array
    const bbox = outputs[OUTPUT_ORDER[i + 6]].data as Float32Array

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const score = Math.sqrt(clamp01(cls[idx]) * clamp01(obj[idx]))
        if (score < SCORE_THRESHOLD) continue
        const cx = (c + bbox[idx * 4 + 0]) * stride
        const cy = (r + bbox[idx * 4 + 1]) * stride
        const w = Math.exp(bbox[idx * 4 + 2]) * stride
        const h = Math.exp(bbox[idx * 4 + 3]) * stride
        faces.push({
          x: cx - w / 2,
          y: cy - h / 2,
          w,
          h,
          score,
        })
      }
    }
  }

  if (faces.length <= 1) {
    return faces.map(f => ({
      x: pyInt(f.x),
      y: pyInt(f.y),
      w: Math.max(1, pyInt(f.w)),
      h: Math.max(1, pyInt(f.h)),
      score: f.score,
      label: 'face' as const,
    }))
  }

  const boxes = faces.map(f => [pyInt(f.x), pyInt(f.y), pyInt(f.w), pyInt(f.h)])
  const scores = faces.map(f => f.score)
  const keep = nmsBoxes(boxes, scores, SCORE_THRESHOLD, NMS_THRESHOLD, TOP_K)
  return keep.map((i) => {
    const f = faces[i]
    return {
      x: pyInt(f.x),
      y: pyInt(f.y),
      w: Math.max(1, pyInt(f.w)),
      h: Math.max(1, pyInt(f.h)),
      score: f.score,
      label: 'face' as const,
    }
  })
}
