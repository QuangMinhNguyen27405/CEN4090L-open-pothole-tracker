import base64
import json
import random
import sys
from pathlib import Path
from urllib.parse import quote

import requests
from ultralytics import YOLO

from utils import (
    HERE,
    backend_preprocess,
    check_no_args,
    get_api_key,
    get_number,
    get_setting,
    label_path_for,
    list_images,
    read_labels,
    resolve_split_dir,
    to_path,
)

BACKEND_THRESHOLD = 0.6
LOW_CONF = 0.01
IOU_NEEDED = 0.5
THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

MAX_FAILURES = 10
SPLITS = ["train", "valid", "test"]
DEFAULT_MODEL = "runs/pothole/weights/best.pt"

DATASETS_DIR = HERE / "datasets"
OUTPUT_DIR = HERE / "runs" / "eval"
ROBOFLOW_URL = "https://detect.roboflow.com"


def xywh_to_xyxy(cx, cy, w, h):
    return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0


def match(preds, gts):
    preds = sorted(preds, key=lambda p: p[0], reverse=True)
    used = [False] * len(gts)
    results = []

    for conf, box in preds:
        best_i, best_iou = -1, IOU_NEEDED
        for i, gt in enumerate(gts):
            if used[i]:
                continue
            overlap = iou(box, gt)
            if overlap >= best_iou:
                best_i, best_iou = i, overlap

        if best_i >= 0:
            used[best_i] = True
            results.append((conf, True))
        else:
            results.append((conf, False))
    return results


def average_precision(records, n_gt):
    if n_gt == 0:
        return 0.0

    records = sorted(records, key=lambda r: r[0], reverse=True)
    tp = fp = 0
    precisions, recalls = [], []
    for _, correct in records:
        if correct:
            tp += 1
        else:
            fp += 1
        precisions.append(tp / (tp + fp))
        recalls.append(tp / n_gt)

    for i in range(len(precisions) - 2, -1, -1):
        precisions[i] = max(precisions[i], precisions[i + 1])

    ap, last_recall = 0.0, 0.0
    for p, r in zip(precisions, recalls):
        ap += (r - last_recall) * p
        last_recall = r
    return ap


def box_scores(records, n_gt, threshold):
    kept = [correct for conf, correct in records if conf >= threshold]
    tp = sum(kept)
    precision = tp / len(kept) if kept else 0.0
    recall = tp / n_gt if n_gt else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def make_local_predictor(model_path, imgsz):
    model = YOLO(model_path)

    def predict(img_path):
        _, img = backend_preprocess(img_path)
        boxes = model.predict(img, conf=LOW_CONF, imgsz=imgsz, verbose=False)[0].boxes

        preds = []
        for (cx, cy, w, h), conf, cls in zip(boxes.xywhn.tolist(), boxes.conf.tolist(), boxes.cls.tolist()):
            if model.names[int(cls)].strip().lower() == "pothole":
                preds.append((conf, xywh_to_xyxy(cx, cy, w, h)))
        return preds

    return predict


def make_roboflow_predictor(project, version, api_key):
    project_path = "/".join(quote(part, safe="") for part in project.split("/"))
    url = f"{ROBOFLOW_URL}/{project_path}/{quote(str(version), safe='')}"

    def predict(img_path):
        jpeg_bytes, img = backend_preprocess(img_path)
        response = requests.post(
            url,
            params={"api_key": api_key, "confidence": int(LOW_CONF * 100)},
            data=base64.b64encode(jpeg_bytes),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        response.raise_for_status()

        width, height = img.size
        preds = []
        for p in response.json()["predictions"]:
            if p["class"].strip().lower() == "pothole":
                box = xywh_to_xyxy(p["x"] / width, p["y"] / height, p["width"] / width, p["height"] / height)
                preds.append((p["confidence"], box))
        return preds

    return predict


def find_data_yaml(data):
    if data:
        return to_path(data)

    combined = DATASETS_DIR / "combined" / "data.yaml"
    if combined.exists():
        return combined
    return DATASETS_DIR / "pothole-jujbl" / "data.yaml"


def pick_model(model, imgsz):
    if model.lower() != "roboflow":
        model_path = to_path(model)
        if not model_path.exists():
            sys.exit(f"Can't find {model_path}. Train one first (python train.py) or set EVAL_MODEL in .env")
        return model, make_local_predictor(str(model_path), imgsz)

    api_key = get_api_key()
    project = get_setting("ROBOFLOW_PROJECT_ID")
    version = get_setting("ROBOFLOW_MODEL_VERSION")
    if not (api_key and project and version):
        sys.exit(
            "EVAL_MODEL=roboflow needs ROBOFLOW_API_KEY, ROBOFLOW_PROJECT_ID and ROBOFLOW_MODEL_VERSION\n"
            "(in training/.env or backend/.env)"
        )
    return f"roboflow {project} v{version}", make_roboflow_predictor(project, version, api_key)


def run_model(images, predict):
    records = []
    per_image = []
    n_gt = 0
    failed = 0

    for i, img_path in enumerate(images, 1):
        gts = [xywh_to_xyxy(*b[1:]) for b in read_labels(label_path_for(img_path))]
        try:
            preds = predict(img_path)
        except Exception as e:
            failed += 1
            if failed >= MAX_FAILURES and failed == i:
                sys.exit(f"Everything is failing ({e}). Check the api key / project / version.")
            continue

        n_gt += len(gts)
        matched = match(preds, gts)
        records += matched

        best_any = max((c for c, _ in matched), default=0.0)
        best_correct = max((c for c, ok in matched if ok), default=0.0)
        per_image.append((len(gts) > 0, best_any, best_correct))

    return records, per_image, n_gt, failed


def backend_mark(threshold):
    return "  <- backend threshold" if threshold == BACKEND_THRESHOLD else ""


def print_box_results(records, n_gt):
    print(f"{'conf':>6}{'precision':>11}{'recall':>9}{'f1':>7}")
    table = {}
    for t in THRESHOLDS:
        p, r, f1 = box_scores(records, n_gt, t)
        table[t] = {"precision": p, "recall": r, "f1": f1}
        print(f"{t:>6.2f}{p:>11.3f}{r:>9.3f}{f1:>7.3f}{backend_mark(t)}")

    candidates = [x / 100 for x in range(5, 96, 5)]
    best_t = max(candidates, key=lambda t: box_scores(records, n_gt, t)[2])
    p, r, f1 = box_scores(records, n_gt, best_t)
    print(f"best F1 is at conf {best_t:.2f} (precision {p:.3f}, recall {r:.3f}, f1 {f1:.3f})")
    return table, best_t


def print_picture_results(per_image):
    pos = [(any_c, ok_c) for has, any_c, ok_c in per_image if has]
    neg = [any_c for has, any_c, _ in per_image if not has]

    print(f"\n{'conf':>6}{'reported':>12}{'right box':>12}{'false alarms':>15}")
    table = {}
    for t in THRESHOLDS:
        reported = sum(a >= t for a, _ in pos)
        right = sum(ok >= t for _, ok in pos)
        alarms = sum(c >= t for c in neg)
        table[t] = {
            "reported": reported,
            "reported_with_right_box": right,
            "pictures_with_potholes": len(pos),
            "false_alarms": alarms,
            "pictures_without_potholes": len(neg),
        }
        reported_text = f"{reported}/{len(pos)}"
        right_text = f"{right}/{len(pos)}"
        alarms_text = f"{alarms}/{len(neg)}"
        print(f"{t:>6.2f}{reported_text:>12}{right_text:>12}{alarms_text:>15}{backend_mark(t)}")
    return table


def results_file(model, name, split):
    if model.lower() != "roboflow":
        model_path = Path(model)
        short = model_path.stem
        if model_path.parent.name == "weights":
            short = model_path.parent.parent.name + "_" + short
    else:
        short = name

    safe_name = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in short)
    return OUTPUT_DIR / f"{safe_name}_{split}.json"


def main():
    check_no_args()

    model = get_setting("EVAL_MODEL", DEFAULT_MODEL)
    data = get_setting("EVAL_DATA")
    split = get_setting("EVAL_SPLIT", "test")
    limit = get_number("EVAL_LIMIT")
    imgsz = get_number("EVAL_IMGSZ", 640)

    if split not in SPLITS:
        sys.exit(f"EVAL_SPLIT={split!r} must be one of {', '.join(SPLITS)}")

    img_dir = resolve_split_dir(find_data_yaml(data), split)
    images = list_images(img_dir)
    if limit and limit < len(images):
        images = random.Random(0).sample(images, limit)

    name, predict = pick_model(model, imgsz)
    records, per_image, n_gt, failed = run_model(images, predict)

    ap50 = average_precision(records, n_gt)
    print(f"AP50: {ap50:.3f} on {len(per_image)} pictures ({failed} failed)\n")

    box_table, best_t = print_box_results(records, n_gt)
    picture_table = print_picture_results(per_image)

    summary = {
        "model": name,
        "data": str(img_dir),
        "split": split,
        "pictures": len(per_image),
        "failed": failed,
        "real_potholes": n_gt,
        "ap50": ap50,
        "best_f1_threshold": best_t,
        "box_level": box_table,
        "picture_level": picture_table,
    }
    out_file = results_file(model, name, split)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Saved results to {out_file}")


if __name__ == "__main__":
    main()
