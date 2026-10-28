import sharp from 'sharp'
import type { NormalizedBlurRegion } from '@shared/types'
import { blurRegionsToPixels } from '../../../shared/moderation/blur-regions.ts'

const BLUR_SIGMA = 18

/**
 * Apply moderator-drawn blur rectangles on top of an existing JPEG buffer.
 */
export async function applyManualBlurRegions(
  jpegBytes: Buffer,
  regions: NormalizedBlurRegion[],
): Promise<Buffer> {
  if (!regions.length) {
    return jpegBytes
  }

  const base = sharp(jpegBytes)
  const meta = await base.metadata()
  const width = meta.width
  const height = meta.height
  if (!width || !height) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image dimensions' })
  }

  const pixelRegions = blurRegionsToPixels(regions, width, height)
  const composites: sharp.OverlayOptions[] = []

  for (const region of pixelRegions) {
    const blurredTile = await sharp(jpegBytes)
      .extract({
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height,
      })
      .blur(BLUR_SIGMA)
      .toBuffer()

    composites.push({
      input: blurredTile,
      left: region.left,
      top: region.top,
    })
  }

  return sharp(jpegBytes).composite(composites).jpeg({ quality: 85 }).toBuffer()
}
