# Plate heuristic evaluation (Phase 1)

Method: download Wikimedia Commons fixtures (`fixtures/plate-detection/manifest.json`), OCR with **Tesseract.js** (English), tokenize, apply `shared/plates/heuristic.ts` regex (`^[A-Z0-9]{2,3}\s?[0-9]{2,3}\s?[A-Z0-9]{2,4}$`).

## Summary

| Metric | Value |
|--------|-------|
| Modern plate images | 3 |
| Hits (expected plate matched) | 0 |
| **Recall (modern, Commons + Tesseract OCR)** | **0.0%** |
| Recall (synthetic OCR snippets, ideal OCR) | 66.7% (2/3) |
| False positive tokens (negative image) | 0 |
| Legacy plate images (excluded from recall) | 1 |

## Per image

```json
[
  {
    "id": "western-cape-02",
    "expected": [
      "CA 101 123"
    ],
    "detected": [],
    "hit": false,
    "ocrSnippet": "4 a - — | ee ————— ia RHR 5 5405 Tm 2 RRR { ’ . C | 1 » UP 07/2008 Co WS 7. "
  },
  {
    "id": "limpopo-sample",
    "expected": [
      "BP 45 678 LP"
    ],
    "detected": [],
    "hit": false,
    "ocrSnippet": "CHZ 231=L "
  },
  {
    "id": "gauteng-bmw-m6",
    "expected": [
      "BR 42 JGP"
    ],
    "detected": [],
    "hit": false,
    "ocrSnippet": "er ————————— PT. ET . ELD seman al 1 a } : MEREEE aie LESEER Rd SE * - . a_i © ———— \" _\" \" A — 4 re Al NY, aa \\ ©. Ne. "
  },
  {
    "id": "historic-pretoria-1978",
    "legacy": true,
    "detected": [],
    "note": "excluded from modern recall"
  },
  {
    "id": "negative-bastille-festival",
    "negative": true,
    "detected": []
  }
]
```

## Caveats

- Mobile uses ML Kit / Vision OCR, not Tesseract; numbers are directional only.
- Expected plate strings are manual labels and may drift from OCR output.
- Historic formats are intentionally excluded from recall.
