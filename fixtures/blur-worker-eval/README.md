# Blur worker eval fixtures

30 openly licensed images (mostly Wikimedia Commons) with SA-relevant plates, people, and road negatives.

- **manifest.json** — source URL, license pointer, expected face/plate **counts** (not pixel-perfect boxes).
- **download-fixtures.sh** / **download_fixtures.py** — fetch images into `images/` (gitignored).

Run evaluation after download: `cd web && npm run blur:compare` (see `docs/blur-worker-eval.md`).
