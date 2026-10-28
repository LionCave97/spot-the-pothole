#!/usr/bin/env bash
# Download OpenCV Zoo ONNX models with pinned SHA-256 (see models/checksums.txt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="${MODEL_DIR:-$ROOT/models}"
mkdir -p "$MODEL_DIR"

FACE_URL="https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
PLATE_URL="https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/license_plate_detection_yunet/license_plate_detection_lpd_yunet_2023mar.onnx"

download() {
  local url="$1"
  local dest="$2"
  local expected="$3"
  echo "Downloading $(basename "$dest")..."
  curl -fsSL "$url" -o "$dest"
  local got
  got="$(sha256sum "$dest" | awk '{print $1}')"
  if [[ "$got" != "$expected" ]]; then
    echo "Checksum mismatch for $dest: expected $expected got $got" >&2
    exit 1
  fi
}

download "$FACE_URL" "$MODEL_DIR/face_detection_yunet_2023mar.onnx" \
  "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"

download "$PLATE_URL" "$MODEL_DIR/license_plate_detection_lpd_yunet_2023mar.onnx" \
  "6d4978a7b6d25514d5e24811b82bfb511d166bdd8ca3b03aa63c1623d4d039c7"

echo "Models ready in $MODEL_DIR"
