import sys
from pathlib import Path

from PIL import ImageDraw
from ultralytics import YOLO

from utils import (
    HERE,
    IMAGE_EXTS,
    backend_preprocess,
    check_no_args,
    get_list,
    get_number,
    get_setting,
    list_images,
    to_path,
)

BACKEND_THRESHOLD = 0.6
DEFAULT_MODEL = "runs/pothole/weights/best.pt"
DEFAULT_IMAGES = "datasets/combined/test/images"
OUTPUT_DIR = HERE / "runs" / "predict"


def find_pictures(inputs, limit):
    pictures = []
    for item in inputs:
        item = Path(item)
        if item.is_dir():
            images = list_images(item)
            if limit:
                images = images[:limit]
            pictures += images
        elif item.suffix.lower() in IMAGE_EXTS:
            pictures.append(item)
    return pictures


def get_predictions(model, img, conf, imgsz):
    boxes = model.predict(img, conf=conf, imgsz=imgsz, verbose=False)[0].boxes

    predictions = []
    for (x, y, w, h), score, cls in zip(boxes.xywh.tolist(), boxes.conf.tolist(), boxes.cls.tolist()):
        predictions.append({
            "class": model.names[int(cls)],
            "confidence": round(score, 3),
            "x": round(x, 1),
            "y": round(y, 1),
            "width": round(w, 1),
            "height": round(h, 1),
        })
    predictions.sort(key=lambda p: p["confidence"], reverse=True)
    return predictions


def draw_boxes(img, predictions):
    draw = ImageDraw.Draw(img)
    for p in predictions:
        x1, y1 = p["x"] - p["width"] / 2, p["y"] - p["height"] / 2
        x2, y2 = p["x"] + p["width"] / 2, p["y"] + p["height"] / 2
        color = "lime" if p["confidence"] >= BACKEND_THRESHOLD else "orange"
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        draw.text((x1 + 3, max(0, y1 - 12)), f"{p['class']} {p['confidence']:.2f}", fill=color)


def main():
    check_no_args()

    model_path = to_path(get_setting("PREDICT_MODEL", DEFAULT_MODEL))
    inputs = [to_path(item) for item in get_list("PREDICT_IMAGES", DEFAULT_IMAGES)]
    conf = get_number("PREDICT_CONF", 0.2, float)
    limit = get_number("PREDICT_LIMIT", 10)
    imgsz = get_number("PREDICT_IMGSZ", 640)

    if not model_path.exists():
        sys.exit(f"Can't find {model_path}. Train one first (python train.py) or set PREDICT_MODEL in .env")

    pictures = find_pictures(inputs, limit)
    if not pictures:
        sys.exit("No pictures to check. Set PREDICT_IMAGES in .env to picture files or folders")

    model = YOLO(str(model_path))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for path in pictures:
        _, img = backend_preprocess(path)
        predictions = get_predictions(model, img, conf, imgsz)

        potholes = [p for p in predictions if p["class"].strip().lower() == "pothole"]
        if potholes and potholes[0]["confidence"] >= BACKEND_THRESHOLD:
            print(f"{path.name}: pothole ({potholes[0]['confidence']:.2f})")
        else:
            print(f"{path.name}: no pothole")

        draw_boxes(img, predictions)
        img.save(OUTPUT_DIR / (path.stem + ".jpg"))

    print(f"Saved pictures with boxes to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
