# Bundled ONNX models

Downloaded at **image build time** via `scripts/download_models.sh` (not committed to git).

| File | Source | License |
|------|--------|---------|
| `face_detection_yunet_2023mar.onnx` | [OpenCV Zoo — face_detection_yunet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) | MIT ([LICENSE](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE)) |
| `license_plate_detection_lpd_yunet_2023mar.onnx` | [OpenCV Zoo — license_plate_detection_yunet](https://github.com/opencv/opencv_zoo/tree/main/models/license_plate_detection_yunet) | Apache-2.0 ([LICENSE](https://github.com/opencv/opencv_zoo/blob/main/models/license_plate_detection_yunet/LICENSE)) |

LPD-YuNet detects **plate regions only**; this worker never runs OCR or reads plate text.

Checksums are pinned in `models/checksums.txt`.
