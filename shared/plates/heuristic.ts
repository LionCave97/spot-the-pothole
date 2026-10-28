/** Plate token heuristic shared with Android/iOS OCR post-processing (Phase 1). */

export const PLATE_TOKEN_REGEX = /^[A-Z0-9]{2,3}\s?[0-9]{2,3}\s?[A-Z0-9]{2,4}$/

export function normalizePlateToken(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ')
}

export function isLikelyPlateToken(token: string): boolean {
  return PLATE_TOKEN_REGEX.test(normalizePlateToken(token))
}

/** Extract plate-like tokens from OCR output (line/word split). */
export function findPlateTokensInText(ocrText: string): string[] {
  const found = new Set<string>()
  for (const line of ocrText.split(/\n/)) {
    const lineToken = normalizePlateToken(line)
    if (isLikelyPlateToken(lineToken)) {
      found.add(lineToken)
    }
    for (const chunk of line.split(/[\s|]+/)) {
      const token = normalizePlateToken(chunk)
      if (isLikelyPlateToken(token)) {
        found.add(token)
      }
    }
  }
  return [...found]
}

export function platesMatchExpected(detected: string, expected: string): boolean {
  const d = normalizePlateToken(detected).replace(/\s/g, '')
  const e = normalizePlateToken(expected).replace(/\s/g, '')
  return d === e || d.includes(e) || e.includes(d)
}
