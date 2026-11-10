import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND_ENV = HERE.parent / "backend" / ".env"

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


def check_no_args():
    if len(sys.argv) > 1:
        sys.exit(f"{Path(sys.argv[0]).name} doesn't take arguments anymore, put the settings in training/.env")


def get_api_key():
    key = get_setting("ROBOFLOW_API_KEY")
    if key:
        return key
    return read_env_file(HERE / ".env").get("_raw")
