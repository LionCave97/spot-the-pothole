/** cv2.dnn.NMSBoxes — NMSFast_ + OpenCV Rect jaccard overlap (Rect2d). */

import { cvRectFromBox, cvRectOverlapIoU } from './opencvRect'

function sortScoreIndices(scores: number[], scoreThreshold: number, topK: number): number[] {
  const scoreIndex: Array<{ score: number, idx: number }> = []
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > scoreThreshold) scoreIndex.push({ score: scores[i], idx: i })
  }
  scoreIndex.sort((a, b) => b.score - a.score || a.idx - b.idx)
  if (topK > 0 && topK < scoreIndex.length) return scoreIndex.slice(0, topK).map(p => p.idx)
  return scoreIndex.map(p => p.idx)
}

function nmsFast(
  boxes: number[][],
  scores: number[],
  scoreThreshold: number,
  nmsThreshold: number,
  topK: number,
): number[] {
  const order = sortScoreIndices(scores, scoreThreshold, topK)
  const indices: number[] = []
  let adaptiveThreshold = nmsThreshold
  const eta = 1.0

  for (const idx of order) {
    const ra = cvRectFromBox(boxes[idx])
    let keep = true
    for (let k = 0; k < indices.length && keep; k++) {
      const rb = cvRectFromBox(boxes[indices[k]])
      const overlap = cvRectOverlapIoU(ra, rb)
      keep = overlap <= adaptiveThreshold
    }
    if (keep) {
      indices.push(idx)
      if (keep && eta < 1 && adaptiveThreshold > 0.5) adaptiveThreshold *= eta
    }
  }
  return indices
}

export function nmsBoxes(
  boxes: number[][],
  scores: number[],
  scoreThreshold: number,
  nmsThreshold: number,
  topK = 5000,
): number[] {
  return nmsFast(boxes, scores, scoreThreshold, nmsThreshold, topK)
}

/** LPD-YuNet internal NMS on dets[:, 0:4] (same Rect encoding as cv2). */
export function nmsBoxesLpdCorners(
  boxes: number[][],
  scores: number[],
  scoreThreshold: number,
  nmsThreshold: number,
  topK = 5000,
): number[] {
  return nmsBoxes(boxes, scores, scoreThreshold, nmsThreshold, topK)
}

export function nmsDetections<T extends { x: number, y: number, w: number, h: number, score: number }>(
  detections: T[],
  iouThreshold = 0.45,
): T[] {
  if (!detections.length) return []
  const boxes = detections.map(d => [d.x, d.y, d.x + d.w, d.y + d.h])
  const scores = detections.map(d => d.score)
  const keep = nmsBoxes(boxes, scores, 0.01, iouThreshold)
  return keep.map(i => detections[i])
}
