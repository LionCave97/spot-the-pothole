import { cropBgrHorizontal, resizeBgrMatchCv2 } from './imageBgr'
import { LpdYunet, detectPlatesPass } from './lpdYunet'
import { getFaceSession, getPlateSession } from './onnxSessions'
import { nmsDetections } from './nms'
import { pyInt } from './pyInt'
import type { Detection } from './types'
import { detectFacesYunet } from './yunetFace'

async function normalizeLongEdge(
  bgr: Uint8Array,
  width: number,
  height: number,
  maxEdge = 1920,
): Promise<{ bgr: Uint8Array, width: number, height: number, normScale: number }> {
  const longEdge = Math.max(height, width)
  if (longEdge <= maxEdge) return { bgr, width, height, normScale: 1 }
  const scale = maxEdge / longEdge
  const newW = pyInt(width * scale)
  const newH = pyInt(height * scale)
  return {
    bgr: await resizeBgrMatchCv2(bgr, width, height, newW, newH),
    width: newW,
    height: newH,
    normScale: scale,
  }
}

async function runFacePass(
  bgr: Uint8Array,
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
): Promise<Detection[]> {
  const session = await getFaceSession()
  const faces = await detectFacesYunet(session, bgr, width, height)
  const inv = scale === 1 ? 1 : 1 / scale
  return faces.map((f) => {
    return {
      x: pyInt(f.x * inv + offsetX),
      y: pyInt(f.y * inv + offsetY),
      w: Math.max(1, pyInt(f.w * inv)),
      h: Math.max(1, pyInt(f.h * inv)),
      score: f.score,
      label: 'face' as const,
    }
  })
}

export async function detectRegions(bgr: Uint8Array, width: number, height: number): Promise<Detection[]> {
  const { bgr: image, width: w, height: h, normScale } = await normalizeLongEdge(bgr, width, height, 1920)
  const plateSession = await getPlateSession()
  const lpd = new LpdYunet(plateSession, { confThreshold: 0.55, nmsThreshold: 0.3 })

  const all: Detection[] = []
  const scales: Array<[number, number, number]> = [[1, 0, 0]]
  if (Math.max(h, w) > 960) scales.push([0.5, 0, 0])

  for (const [scale, ox, oy] of scales) {
    let passBgr = image
    let passW = w
    let passH = h
    if (scale !== 1) {
      passW = pyInt(w * scale)
      passH = pyInt(h * scale)
      passBgr = await resizeBgrMatchCv2(image, w, h, passW, passH)
    }
    all.push(...await runFacePass(passBgr, passW, passH, scale, ox, oy))
    all.push(...await detectPlatesPass(lpd, passBgr, passW, passH, scale, ox, oy))
  }

  if (w >= 1600 && h >= 900) {
    const tileW = Math.trunc(w / 2)
    for (const x0 of [0, tileW]) {
      const tile = cropBgrHorizontal(image, w, h, x0, tileW)
      all.push(...await runFacePass(tile.bgr, tile.width, tile.height, 1, x0, 0))
      all.push(...await detectPlatesPass(lpd, tile.bgr, tile.width, tile.height, 1, x0, 0))
    }
  }

  const faces = nmsDetections(all.filter(d => d.label === 'face'))
  const plates = nmsDetections(all.filter(d => d.label === 'plate'))
  const combined = [...faces, ...plates]
  if (normScale === 1) return combined
  const inv = 1 / normScale
  return combined.map(d => ({
    x: pyInt(d.x * inv),
    y: pyInt(d.y * inv),
    w: Math.max(1, pyInt(d.w * inv)),
    h: Math.max(1, pyInt(d.h * inv)),
    score: d.score,
    label: d.label,
  }))
}
