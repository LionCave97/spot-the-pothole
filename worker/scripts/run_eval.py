#!/usr/bin/env python3
"""Run detector pipeline on blur-worker-eval fixtures and print metrics."""

from __future__ import annotations

import json
import pathlib
import statistics
import sys
import time

import cv2

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures" / "blur-worker-eval"
MANIFEST = FIXTURES / "manifest.json"
IMAGES = FIXTURES / "images"
WORKER = ROOT / "worker"

sys.path.insert(0, str(WORKER))

from src.config import Settings  # noqa: E402
from src.detect import detect_regions  # noqa: E402

FACE_MIN = 0.55
PLATE_MIN = 0.55


def count_detections(detections, label: str, min_score: float) -> int:
    return sum(1 for d in detections if d.label == label and d.score >= min_score)


def main() -> None:
    models_dir = WORKER / "models"
    face_model = models_dir / "face_detection_yunet_2023mar.onnx"
    plate_model = models_dir / "license_plate_detection_lpd_yunet_2023mar.onnx"
    if not face_model.exists():
        raise SystemExit("Run worker/scripts/download_models.sh first")

    manifest = json.loads(MANIFEST.read_text())
    rows = []
    face_tp = face_fn = face_fp = 0
    plate_tp = plate_fn = plate_fp = 0
    latencies: list[float] = []
    skipped: list[str] = []

    for entry in manifest["images"]:
        img_path = IMAGES / f"{entry['id']}.jpg"
        if not img_path.exists():
            skipped.append(entry["id"])
            continue
        data = img_path.read_bytes()
        arr = cv2.imdecode(
            __import__("numpy").frombuffer(data, dtype=__import__("numpy").uint8),
            cv2.IMREAD_COLOR,
        )
        if arr is None:
            skipped.append(entry["id"])
            continue
        t0 = time.perf_counter()
        detections = detect_regions(arr, str(face_model), str(plate_model))
        latencies.append(time.perf_counter() - t0)

        exp_f = int(entry.get("expectedFaceCount", 0))
        exp_p = int(entry.get("expectedPlateCount", 0))
        got_f = count_detections(detections, "face", FACE_MIN)
        got_p = count_detections(detections, "plate", PLATE_MIN)

        cat = entry.get("category", "mixed")
        is_negative = cat == "negative"

        if exp_f > 0:
            if got_f >= exp_f:
                face_tp += exp_f
            else:
                face_tp += got_f
                face_fn += exp_f - got_f
            if got_f > exp_f:
                face_fp += got_f - exp_f
        elif is_negative and got_f > 0:
            face_fp += got_f

        if exp_p > 0 and not entry.get("notes", "").startswith("Legacy"):
            if got_p >= exp_p:
                plate_tp += exp_p
            else:
                plate_tp += got_p
                plate_fn += exp_p - got_p
            if got_p > exp_p:
                plate_fp += got_p - exp_p
        elif is_negative and got_p > 0:
            plate_fp += got_p

        rows.append(
            {
                "id": entry["id"],
                "category": cat,
                "expectedFaces": exp_f,
                "detectedFaces": got_f,
                "expectedPlates": exp_p,
                "detectedPlates": got_p,
                "latencyMs": round(latencies[-1] * 1000, 1),
            }
        )

    face_recall = face_tp / (face_tp + face_fn) if (face_tp + face_fn) else 0.0
    plate_recall = plate_tp / (plate_tp + plate_fn) if (plate_tp + plate_fn) else 0.0

    out = {
        "method": {
            "faceDetector": "YuNet face_detection_yunet_2023mar.onnx",
            "plateDetector": "LPD-YuNet license_plate_detection_lpd_yunet_2023mar.onnx",
            "faceMinScore": FACE_MIN,
            "plateMinScore": PLATE_MIN,
            "multiscale": "0.5x + full + optional horizontal tiles >=1600px",
        },
        "summary": {
            "imagesEvaluated": len(rows),
            "imagesSkippedMissing": len(skipped),
            "faceRecall": round(face_recall, 4),
            "faceFalsePositives": face_fp,
            "plateRecall": round(plate_recall, 4),
            "plateFalsePositives": plate_fp,
            "latencyMsMedian": round(statistics.median(latencies) * 1000, 1) if latencies else None,
            "latencyMsP95": round(
                sorted(latencies)[max(0, int(len(latencies) * 0.95) - 1)] * 1000, 1
            )
            if latencies
            else None,
        },
        "perImage": rows,
        "skippedIds": skipped,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
