/**
 * OpenCV dnn.blobFromImage(image, scalefactor=1, size=auto, mean=0, swapRB=false).
 * Returns NCHW float32 in BGR channel order, values 0–255.
 */
export function blobFromImageBgr(
  bgr: Uint8Array,
  width: number,
  height: number,
  padWidth: number,
  padHeight: number,
): Float32Array {
  const blob = new Float32Array(1 * 3 * padHeight * padWidth)
  for (let y = 0; y < padHeight; y++) {
    for (let x = 0; x < padWidth; x++) {
      let b = 0
      let g = 0
      let r = 0
      if (y < height && x < width) {
        const i = (y * width + x) * 3
        b = bgr[i]
        g = bgr[i + 1]
        r = bgr[i + 2]
      }
      const base = y * padWidth + x
      blob[base] = b
      blob[padWidth * padHeight + base] = g
      blob[2 * padWidth * padHeight + base] = r
    }
  }
  return blob
}

export function padDims(width: number, height: number, divisor = 32): { padW: number, padH: number } {
  const padW = Math.floor((width - 1) / divisor + 1) * divisor
  const padH = Math.floor((height - 1) / divisor + 1) * divisor
  return { padW, padH }
}
