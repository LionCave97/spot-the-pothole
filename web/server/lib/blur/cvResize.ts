import cvModule from '@techstark/opencv-js'

let cvReady: Promise<Cv> | null = null

type Cv = typeof cvModule extends Promise<infer T> ? T : typeof cvModule

async function getCv(): Promise<Cv> {
  if (!cvReady) {
    cvReady = (async () => {
      let cv: Cv
      if (cvModule instanceof Promise) {
        cv = await cvModule
      }
      else if ((cvModule as Cv).Mat) {
        cv = cvModule as Cv
      }
      else {
        await new Promise<void>((resolve) => {
          ;(cvModule as { onRuntimeInitialized?: () => void }).onRuntimeInitialized = () => resolve()
        })
        cv = cvModule as Cv
      }
      return cv
    })()
  }
  return cvReady
}

/** cv2.resize(..., interpolation=cv2.INTER_AREA) on packed BGR. */
export async function resizeBgrMatchCv2(
  bgr: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Promise<Uint8Array> {
  if (srcW === dstW && srcH === dstH) return bgr
  const cv = await getCv()
  const src = cv.matFromArray(srcH, srcW, cv.CV_8UC3, bgr)
  const dst = new cv.Mat()
  cv.resize(src, dst, new cv.Size(dstW, dstH), 0, 0, cv.INTER_AREA)
  const out = new Uint8Array(dstW * dstH * 3)
  out.set(dst.data)
  src.delete()
  dst.delete()
  return out
}
