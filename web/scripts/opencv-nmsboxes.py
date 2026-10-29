#!/usr/bin/env python3
"""Export cv2.dnn.NMSBoxes results (dev helper for regenerating test vectors)."""
import json
import sys

import cv2
import numpy as np


def main() -> None:
    data = json.load(sys.stdin)
    boxes = data["boxes"]
    scores = data["scores"]
    score_threshold = float(data["score_threshold"])
    nms_threshold = float(data["nms_threshold"])
    top_k = int(data.get("top_k", 5000))
    keep = cv2.dnn.NMSBoxes(
        boxes,
        scores,
        score_threshold,
        nms_threshold,
        1.0,
        top_k,
    )
    if keep is None or len(keep) == 0:
        indices: list[int] = []
    elif isinstance(keep, np.ndarray):
        indices = [int(i) for i in keep.flatten().tolist()]
    else:
        indices = [int(i) for i in keep]
    json.dump({"indices": indices}, sys.stdout)


if __name__ == "__main__":
    main()
