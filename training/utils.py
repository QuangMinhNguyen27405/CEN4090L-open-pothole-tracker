import os
import sys
from io import BytesIO
from pathlib import Path

import yaml
from PIL import Image

HERE = Path(__file__).resolve().parent
BACKEND_ENV = HERE.parent / "backend" / ".env"

IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]
TRUE_VALUES = ["1", "true", "yes", "on"]

BACKEND_MAX_SIZE = (640, 480)
BACKEND_JPEG_QUALITY = 75


def read_env_file(path):
    values = {}
    path = Path(path)
    if not path.is_file():
        return values

    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line == "" or line.startswith("#"):
            continue
        if "=" in line:
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
        else:
            values["_raw"] = line
    return values


def get_setting(name, default=None):
    if os.environ.get(name):
        return os.environ[name].strip()

    for env_path in [HERE / ".env", BACKEND_ENV]:
        value = read_env_file(env_path).get(name)
        if value:
            return value
    return default


def get_number(name, default=None, kind=int):
    value = get_setting(name)
    if value is None:
        return default
    try:
        return kind(value)
    except ValueError:
        sys.exit(f"{name}={value!r} in .env must be a number")


def get_flag(name):
    return get_setting(name, "false").lower() in TRUE_VALUES


def get_list(name, default):
    value = get_setting(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def to_path(value):
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = HERE / path
    return path


def check_no_args():
    if len(sys.argv) > 1:
        sys.exit(f"{Path(sys.argv[0]).name} doesn't take arguments anymore, put the settings in training/.env")


def get_api_key():
    key = get_setting("ROBOFLOW_API_KEY")
    if key:
        return key
    return read_env_file(HERE / ".env").get("_raw")


def list_images(folder):
    images = [p for p in Path(folder).iterdir() if p.suffix.lower() in IMAGE_EXTS]
    return sorted(images)


def label_path_for(image_path):
    image_path = Path(image_path)
    return image_path.parent.parent / "labels" / (image_path.stem + ".txt")


def parse_label_line(line):
    parts = line.split()
    if not parts:
        return None, None
    try:
        nums = [float(p) for p in parts]
    except ValueError:
        return None, None

    cls = int(nums[0])

    if len(nums) == 5:
        cx, cy, w, h = nums[1:]
        if w <= 0 or h <= 0:
            return None, None
        return [cls, cx, cy, w, h], "box"

    if len(nums) >= 7 and len(nums) % 2 == 1:
        xs = nums[1::2]
        ys = nums[2::2]
        x1, x2 = max(0.0, min(xs)), min(1.0, max(xs))
        y1, y2 = max(0.0, min(ys)), min(1.0, max(ys))
        if x2 <= x1 or y2 <= y1:
            return None, None
        return [cls, (x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1], "polygon"

    return None, None


def read_labels(label_file):
    label_file = Path(label_file)
    if not label_file.is_file():
        return []

    boxes = []
    for line in label_file.read_text(encoding="utf-8").splitlines():
        box, _ = parse_label_line(line)
        if box is not None:
            boxes.append(box)
    return boxes


def backend_preprocess(image_path):
    with Image.open(image_path) as original:
        img = original.convert("RGB")
    img.thumbnail(BACKEND_MAX_SIZE)

    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=BACKEND_JPEG_QUALITY)
    jpeg_bytes = buffer.getvalue()

    with Image.open(BytesIO(jpeg_bytes)) as decoded:
        return jpeg_bytes, decoded.convert("RGB")


def resolve_split_dir(data_yaml, split):
    data_yaml = Path(data_yaml).resolve()
    data = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))

    key = "val" if split in ["val", "valid"] else split
    if key not in data:
        sys.exit(f"'{key}' is not in {data_yaml}")

    root = data_yaml.parent
    if data.get("path"):
        root = root / data["path"]

    value = str(data[key])
    if value.startswith("../"):
        value = value[3:]

    folder = Path(value)
    if not folder.is_absolute():
        folder = root / folder
    return folder.resolve()
