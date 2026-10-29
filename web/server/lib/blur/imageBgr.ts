import sharp from 'sharp'
import { resizeBgrMatchCv2 as cvResizeBgr } from './cvResize'

export { cvResizeBgr as resizeBgrMatchCv2 }

/** Decode JPEG/PNG bytes to packed BGR (HxW). Matches OpenCV `imdecode` EXIF orientation. */
export async function decodeToBgr(bytes: Buffer): Promise<{ bgr: Uint8Array, width: number, height: number }> {
  const { data, info } = await sharp(bytes, { autoOrient: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const bgr = new Uint8Array(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    bgr[i * 3] = data[i * 3 + 2]
    bgr[i * 3 + 1] = data[i * 3 + 1]
    bgr[i * 3 + 2] = data[i * 3]
  }
  return { bgr, width, height }
}

export function cropBgrHorizontal(
  bgr: Uint8Array,
  srcW: number,
  srcH: number,
  x0: number,
  tileW: number,
): { bgr: Uint8Array, width: number, height: number } {
  const out = new Uint8Array(tileW * srcH * 3)
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < tileW; x++) {
      const si = (y * srcW + (x0 + x)) * 3
      const di = (y * tileW + x) * 3
      out[di] = bgr[si]
      out[di + 1] = bgr[si + 1]
      out[di + 2] = bgr[si + 2]
    }
  }
  return { bgr: out, width: tileW, height: srcH }
}
