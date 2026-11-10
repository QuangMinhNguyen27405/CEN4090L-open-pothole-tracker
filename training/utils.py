import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND_ENV = HERE.parent / "backend" / ".env"

IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]
TRUE_VALUES = ["1", "true", "yes", "on"]


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
