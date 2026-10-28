/** OpenCV Rect_ (cv2.dnn.NMSBoxes) — area, intersection (&), jaccard IoU. */

export type CvRect = { x: number, y: number, width: number, height: number }

export function cvRectFromBox(box: number[]): CvRect {
  return { x: box[0], y: box[1], width: box[2], height: box[3] }
}

export function cvRectArea(r: CvRect): number {
  return r.width * r.height
}

export function cvRectEmpty(r: CvRect): boolean {
  return r.width <= 0 || r.height <= 0
}

/**
 * OpenCV `Rect_& operator&` (opencv2/core/types.hpp).
 * Note: unlike the C++ early-out on empty(), dnn NMS uses this on possibly "empty" rects.
 */
export function cvRectAnd(a: CvRect, b: CvRect): CvRect {
  const Rx_min = a.x < b.x ? a : b
  const Rx_max = a.x < b.x ? b : a
  const Ry_min = a.y < b.y ? a : b
  const Ry_max = a.y < b.y ? b : a

  if (
    (Rx_min.x < 0 && Rx_min.x + Rx_min.width < Rx_max.x)
    || (Ry_min.y < 0 && Ry_min.y + Ry_min.height < Ry_max.y)
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  if (
    Rx_min.width < (Rx_max.x - Rx_min.x)
    || Ry_min.height < (Ry_max.y - Ry_min.y)
  ) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const out: CvRect = {
    x: Rx_max.x,
    y: Ry_max.y,
    width: Math.min(Rx_min.width - (Rx_max.x - Rx_min.x), Rx_max.width),
    height: Math.min(Ry_min.height - (Ry_max.y - Ry_min.y), Ry_max.height),
  }

  if (cvRectEmpty(out)) return { x: 0, y: 0, width: 0, height: 0 }
  return out
}

/** IoU = 1 - jaccardDistance(a,b) per OpenCV dnn rectOverlap. */
export function cvRectOverlapIoU(a: CvRect, b: CvRect): number {
  const Aa = cvRectArea(a)
  const Ab = cvRectArea(b)
  if (Aa + Ab <= Number.EPSILON) return 1.0

  const inter = cvRectAnd(a, b)
  const Aab = cvRectArea(inter)
  const denom = Aa + Ab - Aab
  if (Math.abs(denom) <= Number.EPSILON) return 0
  return Aab / denom
}

export function cvRectOverlapIoUFromBoxes(boxA: number[], boxB: number[]): number {
  return cvRectOverlapIoU(cvRectFromBox(boxA), cvRectFromBox(boxB))
}
