"""Install the locked local toolchains; never overwrite existing configuration."""

from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    if sys.version_info < (3, 12):
        raise SystemExit("Python 3.12+ is required")
    npm = shutil.which("npm")
    node = shutil.which("node")
    if (
        not npm
        or not node
        or int(
            subprocess.check_output([node, "--version"], text=True)
            .strip()
            .lstrip("v")
            .split(".")[0]
        )
        < 20
    ):
        raise SystemExit("Install Node.js 20+ and npm first")
    subprocess.run([sys.executable, "-m", "venv", str(ROOT / ".venv")], check=True)
    python = (
        ROOT
        / ".venv"
        / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    )
    subprocess.run(
        [str(python), "-m", "pip", "install", "-r", "backend/requirements.txt"],
        cwd=ROOT,
        check=True,
    )
    subprocess.run([npm, "ci"], cwd=ROOT, check=True)
    target = ROOT / "backend/.env"
    if not target.exists():
        shutil.copyfile(ROOT / "backend/.env.example", target)
        print(
            "Created backend/.env template. Set your own DB URL/password and ingest/operator credentials before starting the API."
        )
    else:
        print("Existing backend/.env preserved.")
    print(
        "Next: follow docs/TEAM_SETUP.md for PostgreSQL and separate validation databases. No API or device was started."
    )


if __name__ == "__main__":
    main()
