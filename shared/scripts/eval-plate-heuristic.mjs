#!/usr/bin/env node
/**
 * Evaluates the same regex-over-OCR plate heuristic used on mobile (Phase 1).
 * OCR engine: Tesseract.js (English) on downloaded Commons fixtures.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Tesseract from 'tesseract.js'
import {
  findPlateTokensInText,
  platesMatchExpected,
} from '../plates/heuristic.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(root, '..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'fixtures/plate-detection/manifest.json'), 'utf8'),
)
const imageDir = path.join(repoRoot, 'fixtures/plate-detection/images')

const plateImages = manifest.images.filter((i) => i.plateImage)
const negativeImages = manifest.images.filter((i) => !i.plateImage)

let hits = 0
let plateTargets = 0
let falsePositives = 0
const rows = []

for (const entry of manifest.images) {
  const imagePath = path.join(imageDir, `${entry.id}.jpg`)
  if (!fs.existsSync(imagePath)) {
    rows.push({ id: entry.id, status: 'missing_image' })
    continue
  }

  const { data } = await Tesseract.recognize(imagePath, 'eng')
  const detected = findPlateTokensInText(data.text)

  if (entry.plateImage && !entry.legacyFormat) {
    plateTargets += 1
    const expected = entry.expectedPlates ?? []
    const matched = expected.some((exp) =>
      detected.some((tok) => platesMatchExpected(tok, exp)),
    )
    if (matched) hits += 1
    rows.push({
      id: entry.id,
      expected,
      detected,
      hit: matched,
      ocrSnippet: data.text.slice(0, 120).replace(/\s+/g, ' '),
    })
  } else if (entry.plateImage && entry.legacyFormat) {
    rows.push({ id: entry.id, legacy: true, detected, note: 'excluded from modern recall' })
  } else {
    falsePositives += detected.length
    rows.push({ id: entry.id, negative: true, detected })
  }
}

const recall = plateTargets === 0 ? 0 : hits / plateTargets

const syntheticCases = [
  { text: 'CA 101 123', expected: 'CA 101 123' },
  { text: 'BP 45 678 LP', expected: 'BP 45 678 LP' },
  { text: 'BR 42 JGP', expected: 'BR 42 JGP' },
  { text: 'noise GP 12 only', expected: null },
]
let syntheticHits = 0
for (const c of syntheticCases) {
  const detected = findPlateTokensInText(c.text)
  if (c.expected) {
    if (detected.some((tok) => platesMatchExpected(tok, c.expected))) syntheticHits += 1
  }
}
const syntheticRecall = syntheticHits / syntheticCases.filter((c) => c.expected).length

const report = `# Plate heuristic evaluation (Phase 1)

Method: download Wikimedia Commons fixtures (\`fixtures/plate-detection/manifest.json\`), OCR with **Tesseract.js** (English), tokenize, apply \`shared/plates/heuristic.ts\` regex (\`^[A-Z0-9]{2,3}\\s?[0-9]{2,3}\\s?[A-Z0-9]{2,4}$\`).

## Summary

| Metric | Value |
|--------|-------|
| Modern plate images | ${plateTargets} |
| Hits (expected plate matched) | ${hits} |
| **Recall (modern, Commons + Tesseract OCR)** | **${(recall * 100).toFixed(1)}%** |
| Recall (synthetic OCR snippets, ideal OCR) | ${(syntheticRecall * 100).toFixed(1)}% (${syntheticHits}/${syntheticCases.filter((c) => c.expected).length}) |
| False positive tokens (negative image) | ${falsePositives} |
| Legacy plate images (excluded from recall) | ${manifest.images.filter((i) => i.legacyFormat).length} |

## Per image

\`\`\`json
${JSON.stringify(rows, null, 2)}
\`\`\`

## Caveats

- Mobile uses ML Kit / Vision OCR, not Tesseract; numbers are directional only.
- Expected plate strings are manual labels and may drift from OCR output.
- Historic formats are intentionally excluded from recall.
`

fs.writeFileSync(path.join(repoRoot, 'docs/plate-detection-eval.md'), report)
console.log(`Recall (modern): ${(recall * 100).toFixed(1)}% (${hits}/${plateTargets})`)
console.log(`False positive tokens on negative image: ${falsePositives}`)
console.log('Wrote docs/plate-detection-eval.md')
