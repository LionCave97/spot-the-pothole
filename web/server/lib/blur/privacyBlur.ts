import sharp from 'sharp'
import type { Detection } from './types'

export interface BlurApplyResult {
  jpegBytes: Buffer
  blurredFaceCount: number
  blurredPlateCount: number
  minScoreUsed: number | null
}

function padBox(
  x: number,
  y: number,
  w: number,
  h: number,
  imgW: number,
  imgH: number,
  paddingRatio: number,
): { x: number, y: number, w: number, h: number } {
  const padX = Math.floor(w * paddingRatio)
  const padY = Math.floor(h * paddingRatio)
  const x0 = Math.max(0, x - padX)
  const y0 = Math.max(0, y - padY)
  const x1 = Math.min(imgW, x + w + padX)
  const y1 = Math.min(imgH, y + h + padY)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export async function applyPrivacyBlur(
  rgbBytes: Buffer,
  width: number,
  height: number,
  detections: Detection[],
  {
    faceMinScore,
    plateMinScore,
    paddingRatio = 0.12,
    jpegQuality = 82,
  }: {
    faceMinScore: number
    plateMinScore: number
    paddingRatio?: number
    jpegQuality?: number
  },
): Promise<BlurApplyResult> {
  let image = sharp(rgbBytes, { raw: { width, height, channels: 3 } })
  let faceCount = 0
  let plateCount = 0
  let minScore: number | null = null

  const composites: sharp.OverlayOptions[] = []

  for (const det of detections) {
    const threshold = det.label === 'face' ? faceMinScore : plateMinScore
    if (det.score < threshold) continue
    if (minScore === null || det.score < minScore) minScore = det.score
    const box = padBox(det.x, det.y, det.w, det.h, width, height, paddingRatio)
    if (box.w <= 0 || box.h <= 0) continue
    const k = Math.max(15, (Math.min(box.w, box.h) / 2) | 1)
    const sigma = Math.max(1, k / 6)
    const blurredPatch = await sharp(rgbBytes, { raw: { width, height, channels: 3 } })
      .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
      .blur(sigma)
      .toBuffer()
    composites.push({ input: blurredPatch, left: box.x, top: box.y })
    if (det.label === 'face') faceCount++
    else plateCount++
  }

  if (composites.length) {
    image = sharp(rgbBytes, { raw: { width, height, channels: 3 } }).composite(composites)
  }

  const jpegBytes = await image
    .jpeg({ quality: jpegQuality, mozjpeg: true })
    .toBuffer()

  return { jpegBytes, blurredFaceCount: faceCount, blurredPlateCount: plateCount, minScoreUsed: minScore }
}

export function shouldPublish(
  detections: Detection[],
  blurMinScore: number | null,
  settings: { faceBlurMinScore: number, plateBlurMinScore: number, publishMinScore: number },
): { ok: boolean, reason: string } {
  if (blurMinScore !== null && blurMinScore < settings.publishMinScore) {
    return { ok: false, reason: 'low_confidence_detection' }
  }
  for (const det of detections) {
    const threshold = det.label === 'face' ? settings.faceBlurMinScore : settings.plateBlurMinScore
    if (det.score >= threshold && det.score < settings.publishMinScore) {
      return { ok: false, reason: 'low_confidence_detection' }
    }
  }
  return { ok: true, reason: 'ok' }
}
