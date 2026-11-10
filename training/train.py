"""Fine-tune a YOLO model to detect potholes.

Every setting comes from a TRAIN_* environment variable, usually set in
training/.env (see .env.example for the full list). Variables already set in
the shell take precedence over the file, so one run can be changed without
editing it:

    python train.py
    TRAIN_EPOCHS=1 TRAIN_FRACTION=0.05 python train.py    # quick smoke test (bash)

Relative paths are resolved against this folder, so the script behaves the
same no matter where it is started from.

Exit codes: 0 success, 1 training failed, 2 invalid configuration, 130 interrupted.
"""

import os
import re
import sys
import traceback
from pathlib import Path

import torch
from dotenv import load_dotenv
from ultralytics import YOLO

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE / ".env"

DEFAULTS = {
    "TRAIN_DATA": "datasets/combined/data.yaml",
    "TRAIN_MODEL": "yolo11n.pt",
    "TRAIN_EPOCHS": "50",
    "TRAIN_IMGSZ": "640",
    "TRAIN_BATCH": "16",
    "TRAIN_PATIENCE": "15",
    "TRAIN_FRACTION": "1.0",
    "TRAIN_DEVICE": "auto",
    "TRAIN_SEED": "0",
    "TRAIN_RUNS_DIR": "runs",
    "TRAIN_RUN_NAME": "pothole",
    "TRAIN_OVERWRITE": "false",
}

TRUE_VALUES = ["1", "true", "yes", "on"]
FALSE_VALUES = ["0", "false", "no", "off"]

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_CONFIG = 2
EXIT_INTERRUPTED = 130


def get_value(name):
    value = os.environ.get(name, "").strip()
    return value or DEFAULTS[name]


def to_path(value):
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = HERE / path
    return path


def get_int(name, minimum, errors):
    value = get_value(name)
    try:
        number = int(value)
    except ValueError:
        errors.append(f"{name}={value!r} is not a whole number")
        return minimum

    if number < minimum:
        errors.append(f"{name}={number} must be at least {minimum}")
    return number


def get_model(errors):
    model = get_value("TRAIN_MODEL")
    if (HERE / model).is_file():
        return str(HERE / model)

    looks_like_path = Path(model).is_absolute() or "/" in model or "\\" in model
    if not looks_like_path:
        return model

    model_path = to_path(model)
    if not model_path.is_file():
        errors.append(f"TRAIN_MODEL: {model_path} not found")
    return str(model_path)


def get_fraction(errors):
    value = get_value("TRAIN_FRACTION")
    try:
        fraction = float(value)
    except ValueError:
        errors.append(f"TRAIN_FRACTION={value!r} is not a number")
        return 1.0

    if not 0 < fraction <= 1:
        errors.append(f"TRAIN_FRACTION={fraction} must be greater than 0 and at most 1")
    return fraction


def load_config():
    errors = []

    data = to_path(get_value("TRAIN_DATA"))
    if not data.is_file():
        errors.append(
            f"TRAIN_DATA: {data} not found. Run download_dataset.py, then prepare_dataset.py "
            "(or point TRAIN_DATA at another data.yaml)"
        )

    model = get_model(errors)
    epochs = get_int("TRAIN_EPOCHS", 1, errors)

    imgsz = get_int("TRAIN_IMGSZ", 32, errors)
    if imgsz % 32 != 0:
        errors.append(f"TRAIN_IMGSZ={imgsz} must be a multiple of 32")

    batch = get_int("TRAIN_BATCH", -1, errors)
    if batch == 0:
        errors.append("TRAIN_BATCH must be -1 (automatic) or a positive number")

    patience = get_int("TRAIN_PATIENCE", 0, errors)
    seed = get_int("TRAIN_SEED", 0, errors)
    fraction = get_fraction(errors)

    device = get_value("TRAIN_DEVICE").lower().replace(" ", "")
    if device not in ["auto", "cpu", "mps"] and not re.fullmatch(r"\d+(,\d+)*", device):
        errors.append(f"TRAIN_DEVICE={device!r} must be auto, cpu, mps, or GPU indices like 0 or 0,1")

    run_name = get_value("TRAIN_RUN_NAME")
    if any(ch in run_name for ch in "/\\:") or run_name in [".", ".."]:
        errors.append(f"TRAIN_RUN_NAME={run_name!r} must be a plain folder name")

    overwrite = get_value("TRAIN_OVERWRITE").lower()
    if overwrite not in TRUE_VALUES + FALSE_VALUES:
        errors.append(f"TRAIN_OVERWRITE={overwrite!r} must be true or false")

    config = {
        "data": data,
        "model": model,
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "patience": patience,
        "fraction": fraction,
        "device": device,
        "seed": seed,
        "runs_dir": to_path(get_value("TRAIN_RUNS_DIR")),
        "run_name": run_name,
        "overwrite": overwrite in TRUE_VALUES,
    }
    return config, errors


def pick_device(requested):
    if requested == "auto":
        if torch.cuda.is_available():
            return "0"
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    if requested == "cpu":
        return "cpu"

    if requested == "mps":
        if not torch.backends.mps.is_available():
            raise ValueError("TRAIN_DEVICE=mps but Apple MPS is not available on this machine")
        return "mps"

    if not torch.cuda.is_available():
        raise ValueError(
            f"TRAIN_DEVICE={requested} but no CUDA GPU is available (torch {torch.__version__}). Use auto or cpu."
        )
    count = torch.cuda.device_count()
    missing = [i for i in requested.split(",") if int(i) >= count]
    if missing:
        raise ValueError(f"TRAIN_DEVICE={requested}: GPU(s) {', '.join(missing)} not found ({count} available)")
    return requested


def train(config, device):
    model = YOLO(config["model"])
    model.train(
        data=str(config["data"]),
        epochs=config["epochs"],
        imgsz=config["imgsz"],
        batch=config["batch"],
        patience=config["patience"],
        fraction=config["fraction"],
        device=device,
        project=str(config["runs_dir"]),
        name=config["run_name"],
        exist_ok=config["overwrite"],
        seed=config["seed"],
    )

    best = Path(model.trainer.best)
    if not best.is_file():
        raise RuntimeError(f"Training finished but {best} was not written")
    return best


def main():
    args = sys.argv[1:]
    if args:
        print(__doc__)
        if args in [["-h"], ["--help"]]:
            sys.exit(EXIT_OK)
        sys.exit(EXIT_CONFIG)

    load_dotenv(ENV_FILE)

    config, errors = load_config()
    device = None
    if not errors:
        try:
            device = pick_device(config["device"])
        except ValueError as e:
            errors.append(str(e))

    if errors:
        print("Invalid configuration:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        sys.exit(EXIT_CONFIG)

    try:
        best = train(config, device)
    except KeyboardInterrupt:
        sys.exit(EXIT_INTERRUPTED)
    except Exception:
        traceback.print_exc()
        sys.exit(EXIT_FAILED)

    print(f"Best weights: {best}")


if __name__ == "__main__":
    main()
