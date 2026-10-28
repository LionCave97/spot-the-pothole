# Plate detection evaluation fixtures

Openly licensed images listed in `manifest.json` (Wikimedia Commons). **Images are not committed** (see `.gitignore`).

## Download

```bash
./fixtures/plate-detection/download-fixtures.sh
```

## Evaluate heuristic (OCR via Tesseract.js + `shared/plates/heuristic.ts`)

```bash
cd shared && npm install && npm run eval:plates
```

Results are written to `docs/plate-detection-eval.md`.

Expected plate strings in the manifest are best-effort labels for modern-format plates; historic plates are marked `legacyFormat` and may not match the Phase 1 regex.
