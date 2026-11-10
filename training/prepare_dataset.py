import hashlib
import shutil
import sys

from utils import HERE, check_no_args, get_flag, get_list, get_setting, label_path_for, list_images, parse_label_line

DATASETS_DIR = HERE / "datasets"

SOURCES = {
    "jujbl": "pothole-jujbl",
    "smartathon": "smartathon",
}

SPLITS = ["train", "valid", "test"]
SPLIT_PRIORITY = ["test", "valid", "train"]

POTHOLE_CLASS = 0
SAME_POTHOLE_IOU = 0.5
SAME_POTHOLE_INSIDE = 0.8


def file_hash(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def link_or_copy(src, dst):
    try:
        dst.hardlink_to(src)
    except OSError:
        shutil.copy2(src, dst)


def overlap(a, b):
    ax1, ay1, ax2, ay2 = a[1] - a[3] / 2, a[2] - a[4] / 2, a[1] + a[3] / 2, a[2] + a[4] / 2
    bx1, by1, bx2, by2 = b[1] - b[3] / 2, b[2] - b[4] / 2, b[1] + b[3] / 2, b[2] + b[4] / 2
    inter = max(0, min(ax2, bx2) - max(ax1, bx1)) * max(0, min(ay2, by2) - max(ay1, by1))
    area_a, area_b = a[3] * a[4], b[3] * b[4]
    return inter / (area_a + area_b - inter), inter / area_a


def already_boxed(polygon, boxes):
    for box in boxes:
        iou, inside = overlap(polygon, box)
        if iou >= SAME_POTHOLE_IOU or inside >= SAME_POTHOLE_INSIDE:
            return True
    return False


def clean_label_file(label_file):
    if not label_file.exists():
        return ""

    boxes, polygons = [], []
    for line in label_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        box, kind = parse_label_line(line)
        if box is None or box[0] != POTHOLE_CLASS:
            continue
        if kind == "polygon":
            polygons.append(box)
        else:
            boxes.append(box)

    for polygon in polygons:
        if not already_boxed(polygon, boxes):
            boxes.append(polygon)

    lines = [f"{POTHOLE_CLASS} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for _, cx, cy, w, h in boxes]
    return "\n".join(lines) + ("\n" if lines else "")


def find_images(sources):
    items = []
    for source in sources:
        src_dir = DATASETS_DIR / SOURCES[source]
        if not (src_dir / "data.yaml").exists():
            sys.exit(f"Can't find {src_dir}. Download it first with python download_dataset.py")

        for split in SPLITS:
            img_dir = src_dir / split / "images"
            if img_dir.exists():
                for img in list_images(img_dir):
                    items.append((split, source, img))
    return items


def remove_duplicates(items):
    items = sorted(items, key=lambda item: SPLIT_PRIORITY.index(item[0]))
    seen = set()
    keep = []

    for split, source, img in items:
        h = file_hash(img)
        if h not in seen:
            seen.add(h)
            keep.append((split, source, img))

    return keep


def write_dataset(keep, out_dir, sources):
    counts = {}
    for split, source, img in keep:
        images_dir = out_dir / split / "images"
        labels_dir = out_dir / split / "labels"
        images_dir.mkdir(parents=True, exist_ok=True)
        labels_dir.mkdir(parents=True, exist_ok=True)

        link_or_copy(img, images_dir / f"{source}_{img.name}")
        label_text = clean_label_file(label_path_for(img))
        (labels_dir / f"{source}_{img.stem}.txt").write_text(label_text, encoding="utf-8")

        n_boxes = len(label_text.splitlines())
        c = counts.setdefault((split, source), [0, 0, 0])
        c[0] += 1
        c[1] += n_boxes
        if n_boxes == 0:
            c[2] += 1

    yaml_text = (
        "# made by prepare_dataset.py from: " + ", ".join(SOURCES[s] for s in sources) + "\n"
        "train: ../train/images\n"
        "val: ../valid/images\n"
        "test: ../test/images\n"
        "\n"
        "nc: 1\n"
        "names: ['Pothole']\n"
    )
    (out_dir / "data.yaml").write_text(yaml_text, encoding="utf-8")
    return counts


def print_summary(sources, counts):
    print(f"{'split':<7}{'source':<12}{'images':>8}{'boxes':>8}{'no pothole':>12}")
    for split in SPLITS:
        for source in sources:
            if (split, source) in counts:
                imgs, boxes, empty = counts[(split, source)]
                print(f"{split:<7}{source:<12}{imgs:>8}{boxes:>8}{empty:>12}")


def main():
    check_no_args()

    sources = get_list("PREPARE_SOURCES", ",".join(SOURCES))
    out_name = get_setting("PREPARE_OUT", "combined")
    force = get_flag("PREPARE_FORCE")

    unknown = [source for source in sources if source not in SOURCES]
    if unknown:
        sys.exit(f"PREPARE_SOURCES: don't know {', '.join(unknown)}. Choose from {', '.join(SOURCES)}")
    if any(ch in out_name for ch in "/\\:") or out_name in [".", ".."]:
        sys.exit(f"PREPARE_OUT={out_name!r} must be a plain folder name")

    out_dir = DATASETS_DIR / out_name
    if out_dir.exists():
        if not force:
            sys.exit(f"{out_dir} already exists. Set PREPARE_FORCE=true in .env to rebuild it.")
        shutil.rmtree(out_dir)

    items = find_images(sources)
    keep = remove_duplicates(items)
    counts = write_dataset(keep, out_dir, sources)
    print_summary(sources, counts)


if __name__ == "__main__":
    main()
