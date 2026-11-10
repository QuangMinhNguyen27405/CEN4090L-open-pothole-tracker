import argparse
import sys

from roboflow import Roboflow

from utils import HERE, get_api_key

DATASETS_DIR = HERE / "datasets"


def parse_args():
    parser = argparse.ArgumentParser(description="Download a pothole dataset from Roboflow in YOLO format")
    parser.add_argument("workspace", help="workspace id from the dataset url")
    parser.add_argument("project", help="project id from the dataset url")
    parser.add_argument("version", type=int, help="dataset version number")
    parser.add_argument("--folder", help="folder name inside datasets/ (default: the project id)")
    parser.add_argument("--force", action="store_true", help="download again even if the folder already exists")
    return parser.parse_args()


def main():
    args = parse_args()

    out_dir = DATASETS_DIR / (args.folder or args.project)
    if (out_dir / "data.yaml").exists() and not args.force:
        print(f"[skip] {out_dir} is already downloaded, use --force to download it again")
        return

    api_key = get_api_key()
    if not api_key:
        sys.exit("No Roboflow API key found!\nSet ROBOFLOW_API_KEY or put it in training/.env")

    DATASETS_DIR.mkdir(exist_ok=True)
    rf = Roboflow(api_key=api_key)
    project = rf.workspace(args.workspace).project(args.project)
    project.version(args.version).download("yolov8", location=str(out_dir), overwrite=True)


if __name__ == "__main__":
    main()
