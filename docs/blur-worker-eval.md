# Blur worker evaluation (DEV-211)

Open-source **YuNet** (faces) and **LPD-YuNet** (plate regions only, no OCR) as implemented in `web/server/lib/blur/detectRegions.ts`, evaluated on **30** Wikimedia Commons images listed in `fixtures/blur-worker-eval/manifest.json` (South African plates, people, and road/scene negatives). Images are not committed; run `fixtures/blur-worker-eval/download-fixtures.sh`.

## Method

| Setting | Value |
|---------|--------|
| Face model | `face_detection_yunet_2023mar.onnx` (MIT) |
| Plate model | `license_plate_detection_lpd_yunet_2023mar.onnx` (Apache-2.0) |
| Face score floor (counted / blurred) | 0.55 |
| Plate score floor (LPD conf + counted) | 0.55 |
| Long edge cap | 1920 px (matches app upload limit) |
| Multi-scale | Full resolution, 0.5× downscale when long edge > 960 px, optional horizontal 2-tile pass when ≥ 1600×900 |
| Recall | Fraction of **expected instance counts** matched (detections ≥ floor; capped at expected per image) |
| False positives | Extra detections above floor on positive images + any face/plate detection on **negative** images |

Hardware: Cloud Agent VM (CPU only), OpenCV 4.10 headless, no GPU.

## Summary

| Metric | Value |
|--------|-------|
| Images evaluated | 30 |
| **Face recall** | **100%** (11/11 expected instances) |
| Face false positives | 31 (mostly crowd/sculpture/statue false triggers; manifest uses conservative face counts) |
| **Plate recall** | **83.3%** (10/12 modern plate instances; legacy/historic plates excluded from denominator where noted in manifest) |
| Plate false positives | 57 (LPD tuned on Chinese plates; SA scenic/text regions still fire) |
| Latency median | **1272 ms** / image (detector only, single CPU core) |
| Latency p95 | **2220 ms** |
| Container image size | **~500 MB** estimated (`python:3.12-slim` + OpenCV + ONNX models); **not verified** in CI (Docker unavailable on eval runner) |

## Interpretation

- **Recall** is acceptable for a first server-side gate, but **plate false positives remain high** — expect extra blurred patches on some road/scene photos until thresholds or a moderator queue (DEV-212) catches edge cases.
- **Historic / non-standard plates** (e.g. pre-1978) are often missed by LPD-YuNet; those should stay `pending` or go to moderators.
- **Latency** is fine for async webhook processing; not sized for synchronous API paths.

## Reproduce

```bash
cd web && npm run blur:models
cd ../fixtures/blur-worker-eval && ./download-fixtures.sh
cd ../../web && npm run blur:compare
```

Parity baseline: `fixtures/blur-worker-eval/detection-counts-baseline.json` (face/plate counts at ≥ 0.55).

## Sample per-image results

| id | category | exp F / det F | exp P / det P | ms |
|----|----------|---------------|---------------|-----|
| plate-western-cape-02 | plate | 0/0 | 1/4 | 522 |
| plate-gauteng-bmw | plate | 0/0 | 1/1 | 1738 |
| plate-historic-pretoria | plate | 0/0 | 1/6 | 606 |
| face-sa-portrait | face | 1/1 | 0/0 | 891 |
| car-show-jhb | mixed | 1/3 | 1/2 | 1544 |
| negative-jhb-skyline | negative | 0/0 | 0/0 | 412 |

Full JSON per-image rows: run `python3 worker/scripts/run_eval.py`.

## Unit tests

Webhook auth/routing and blur masking: `cd worker && PYTHONPATH=. pytest`.
