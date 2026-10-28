/** Normalized blur rectangles (0–1) drawn by moderators on the review UI. */

export interface NormalizedBlurRegion {
  x: number
  y: number
  width: number
  height: number
}

const MAX_REGIONS = 12

export function validateBlurRegions(regions: unknown): NormalizedBlurRegion[] | null {
  if (!Array.isArray(regions)) {
    return null
  }
  if (regions.length > MAX_REGIONS) {
    return null
  }

  const parsed: NormalizedBlurRegion[] = []
  for (const raw of regions) {
    if (!raw || typeof raw !== 'object') {
      return null
    }
    const r = raw as Record<string, unknown>
    const x = r.x
    const y = r.y
    const width = r.width
    const height = r.height
    if (
      typeof x !== 'number'
      || typeof y !== 'number'
      || typeof width !== 'number'
      || typeof height !== 'number'
      || !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(width)
      || !Number.isFinite(height)
    ) {
      return null
    }
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      return null
    }
    if (x + width > 1.0001 || y + height > 1.0001) {
      return null
    }
    parsed.push({
      x: clamp01(x),
      y: clamp01(y),
      width: clamp01(width),
      height: clamp01(height),
    })
  }
  return parsed
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export interface PixelBlurRegion {
  left: number
  top: number
  width: number
  height: number
}

/** Convert normalized regions to integer pixel rects for sharp extract/composite. */
export function blurRegionsToPixels(
  regions: NormalizedBlurRegion[],
  imageWidth: number,
  imageHeight: number,
): PixelBlurRegion[] {
  return regions.map((r) => {
    const left = Math.max(0, Math.floor(r.x * imageWidth))
    const top = Math.max(0, Math.floor(r.y * imageHeight))
    const width = Math.max(1, Math.ceil(r.width * imageWidth))
    const height = Math.max(1, Math.ceil(r.height * imageHeight))
    const maxW = imageWidth - left
    const maxH = imageHeight - top
    return {
      left,
      top,
      width: Math.min(width, maxW),
      height: Math.min(height, maxH),
    }
  })
}
