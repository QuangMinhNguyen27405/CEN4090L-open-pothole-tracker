import sys

from roboflow import Roboflow

from utils import HERE, check_no_args, get_api_key, get_flag, get_number, get_setting

DATASETS_DIR = HERE / "datasets"


def main():
    check_no_args()

    workspace = get_setting("DOWNLOAD_WORKSPACE")
    project = get_setting("DOWNLOAD_PROJECT")
    version = get_number("DOWNLOAD_VERSION")
    folder = get_setting("DOWNLOAD_FOLDER", project)
    force = get_flag("DOWNLOAD_FORCE")

    if not (workspace and project and version):
        sys.exit("Set DOWNLOAD_WORKSPACE, DOWNLOAD_PROJECT and DOWNLOAD_VERSION in training/.env")
    if any(ch in folder for ch in "/\\:") or folder in [".", ".."]:
        sys.exit(f"DOWNLOAD_FOLDER={folder!r} must be a plain folder name")

    out_dir = DATASETS_DIR / folder
    if (out_dir / "data.yaml").exists() and not force:
        print(f"[skip] {out_dir} is already downloaded, set DOWNLOAD_FORCE=true to download it again")
        return

    api_key = get_api_key()
    if not api_key:
        sys.exit("No Roboflow API key found!\nSet ROBOFLOW_API_KEY or put it in training/.env")

    DATASETS_DIR.mkdir(exist_ok=True)
    rf = Roboflow(api_key=api_key)
    rf.workspace(workspace).project(project).version(version).download("yolov8", location=str(out_dir), overwrite=True)


if __name__ == "__main__":
    main()
