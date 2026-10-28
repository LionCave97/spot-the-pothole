import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '../..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'fixtures/plate-detection/manifest.json'), 'utf8'),
)
const outDir = path.join(root, 'fixtures/plate-detection/images')
fs.mkdirSync(outDir, { recursive: true })

for (const entry of manifest.images) {
  const dest = path.join(outDir, `${entry.id}.jpg`)
  if (fs.existsSync(dest)) {
    console.log('skip', entry.id)
    continue
  }
  console.log('download', entry.id)
  let res
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(entry.downloadUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'SpotThePothole-PlateEval/1.0 (https://github.com/LionCave97/spot-the-pothole; research)',
      },
    })
    if (res.status !== 429) break
    await new Promise((r) => setTimeout(r, attempt * 2000))
  }
  if (!res.ok) throw new Error(`Failed ${entry.id}: ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

console.log('Downloaded to', outDir)
