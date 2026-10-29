#!/usr/bin/env node
/** Compare TS resize/NMS helpers against OpenCV (used while tuning parity). */
import { createJiti } from 'jiti'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const jiti = createJiti(import.meta.url)
const { nmsBoxes } = jiti('../server/lib/blur/nms')

const pyResize = `
import cv2, numpy as np, sys, json
bgr = np.frombuffer(sys.stdin.buffer.read(), dtype=np.uint8)
w,h,dw,dh = map(int, sys.argv[1:5])
img = bgr.reshape(h,w,3)
out = cv2.resize(img, (dw,dh), interpolation=cv2.INTER_AREA)
sys.stdout.buffer.write(out.tobytes())
`

async function compareResize(imgPath, dw, dh) {
  const bytes = readFileSync(imgPath)
  const { decodeToBgr, resizeBgrMatchCv2 } = jiti('../server/lib/blur/imageBgr')
  const { bgr, width, height } = await decodeToBgr(bytes)
  const ts = resizeBgrMatchCv2(bgr, width, height, dw, dh)
  const py = execFileSync('python3', ['-c', pyResize, String(width), String(height), String(dw), String(dh)], {
    input: Buffer.from(bgr),
    maxBuffer: 50 * 1024 * 1024,
  })
  let diff = 0
  for (let i = 0; i < Math.min(ts.length, py.length); i++) {
    if (ts[i] !== py[i]) diff++
  }
  return { diffPixels: diff, total: ts.length / 3 }
}

function compareNms() {
  const py = `
import cv2, json, random
random.seed(42)
boxes=[[random.randint(0,200), random.randint(0,200), random.randint(20,120), random.randint(20,120)] for _ in range(50)]
scores=[random.random() for _ in range(50)]
idx=cv2.dnn.NMSBoxes(boxes, scores, 0.55, 0.3, 1.0, 5000)
if len(idx)==0: out=[]
else:
  import numpy as np
  out=sorted(int(i) for i in np.array(idx).reshape(-1))
print(json.dumps({"boxes":boxes,"scores":scores,"keep":out}))
`
  const raw = execFileSync('python3', ['-c', py], { encoding: 'utf8' })
  const { boxes, scores, keep } = JSON.parse(raw)
  const tsKeep = nmsBoxes(boxes, scores, 0.55, 0.3, 5000)
  return { cv: keep, ts: tsKeep.sort((a, b) => a - b), match: JSON.stringify(keep) === JSON.stringify(tsKeep.sort((a, b) => a - b)) }
}

const img = join(__dirname, '../../fixtures/blur-worker-eval/images/plate-western-cape-02.jpg')
compareResize(img, 975, 240).then((r) => {
  console.log('resize', r)
  console.log('nms', compareNms())
})
