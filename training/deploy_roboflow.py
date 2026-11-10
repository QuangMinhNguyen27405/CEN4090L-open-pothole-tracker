import sys
from pathlib import Path

import ultralytics
import yaml
from roboflow import Roboflow

from utils import check_no_args, get_api_key, get_number, get_setting, to_path

DEFAULT_RUN = "runs/pothole"
WEIGHTS_FILE = "weights/best.pt"
YOLOV8_ULTRALYTICS_VERSION = "8.0.196"


def guess_model_type(run_dir):
    args_file = run_dir / "args.yaml"
    if not args_file.exists():
        return None

    train_args = yaml.safe_load(args_file.read_text(encoding="utf-8")) or {}
    model = Path(str(train_args.get("model", ""))).stem.lower()

    if model.startswith("yolo11"):
        return "yolov11" + model[len("yolo11"):]
    if model.startswith(("yolov8", "yolo26")):
        return model
    return None


def main():
    check_no_args()

    workspace = get_setting("ROBOFLOW_WORKSPACE")
    project = get_setting("ROBOFLOW_PROJECT_ID")
    version = get_number("ROBOFLOW_MODEL_VERSION")
    run_dir = to_path(get_setting("DEPLOY_RUN", DEFAULT_RUN))

    if not (workspace and project and version):
        sys.exit("Set ROBOFLOW_WORKSPACE, ROBOFLOW_PROJECT_ID and ROBOFLOW_MODEL_VERSION in training/.env")

    weights = run_dir / WEIGHTS_FILE
    if not weights.exists():
        sys.exit(f"Can't find {weights}. Did training finish?")

    model_type = get_setting("DEPLOY_MODEL_TYPE") or guess_model_type(run_dir)
    if not model_type:
        sys.exit("Couldn't figure out the model type from args.yaml, set DEPLOY_MODEL_TYPE in .env (like yolov11n)")

    api_key = get_api_key()
    if not api_key:
        sys.exit("No Roboflow API key found! Set ROBOFLOW_API_KEY or put it in training/.env")

    if model_type.startswith("yolov8") and ultralytics.__version__ != YOLOV8_ULTRALYTICS_VERSION:
        print(f"Warning: roboflow only takes yolov8 weights made with ultralytics {YOLOV8_ULTRALYTICS_VERSION} "
              f"(you have {ultralytics.__version__}). Retrain with TRAIN_MODEL=yolo11n.pt to avoid this.")

    question = f"Upload {weights} to {workspace}/{project} v{version} as {model_type}? [y/N] "
    if input(question).strip().lower() != "y":
        return

    rf = Roboflow(api_key=api_key)
    rf.workspace(workspace).project(project).version(version).deploy(model_type, str(run_dir), WEIGHTS_FILE)

    print(f"Uploaded. Make sure backend/.env has ROBOFLOW_PROJECT_ID={project} and ROBOFLOW_MODEL_VERSION={version}")


if __name__ == "__main__":
    main()
