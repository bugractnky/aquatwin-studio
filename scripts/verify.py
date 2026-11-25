"""Run unit/build/PostgreSQL tests and isolated browser checks, cleaning up owned servers."""

from pathlib import Path
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def test_url(name):
    value = os.environ.get(name, "")
    url = urlparse(value)
    if url.scheme not in ("postgres", "postgresql") or not url.path.lstrip(
        "/"
    ).startswith("aquatwin_test"):
        raise SystemExit(
            f"{name} must point to a dedicated PostgreSQL aquatwin_test* database"
        )
    return value


def wait(url, process):
    deadline = time.monotonic() + 55
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError("Validation server exited; inspect test-results logs")
        try:
            with urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except (OSError, ValueError):
            pass
        time.sleep(0.3)
    raise RuntimeError("Validation server startup timed out")


def main():
    unit_db = test_url("TEST_DATABASE_URL")
    e2e_db = test_url("E2E_DATABASE_URL")

    def identity(value):
        u = urlparse(value)
        return (u.hostname, u.port or 5432, u.path)

    if identity(unit_db) == identity(e2e_db):
        raise SystemExit("Unit and E2E databases must be different")
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("npm not found")
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT / "backend")
    for command in [
        [npm, "test"],
        [npm, "run", "build"],
        [sys.executable, "-m", "pytest", "-q", "backend/tests"],
    ]:
        subprocess.run(command, cwd=ROOT, env=env, check=True)
    api_port = int(env.get("E2E_API_PORT", "8001"))
    ui_port = int(env.get("E2E_FRONTEND_PORT", "5177"))
    for port in (api_port, ui_port):
        with socket.socket() as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("127.0.0.1", port))  # fail before claiming someone else's server
    api = f"http://127.0.0.1:{api_port}"
    ui = f"http://127.0.0.1:{ui_port}"
    env.update(
        DATABASE_URL=e2e_db,
        AQUATWIN_INGEST_TOKEN=env.get(
            "E2E_INGEST_TOKEN", "local-validation-ingest-only"
        ),
        AQUATWIN_OPERATOR_PASSWORD=env.get(
            "E2E_OPERATOR_PASSWORD", "local-validation-operator-only"
        ),
        AQUATWIN_OPERATOR_ORIGINS=ui,
        AQUATWIN_SECURE_COOKIES="false",
        AQUATWIN_API_PROXY_TARGET=api,
        E2E_API_URL=api,
        E2E_BASE_URL=ui,
    )
    output = ROOT / "test-results"
    output.mkdir(exist_ok=True)
    # Playwright clears test-results at startup: server logs live in a separate ignored folder.
    logs = ROOT / "validation-logs"
    logs.mkdir(exist_ok=True)
    children = []
    files = []
    try:
        for name, command, url in [
            (
                "api",
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--app-dir",
                    "backend",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(api_port),
                ],
                api + "/api/v1/health",
            ),
            (
                "vite",
                [npm, "run", "dev", "--", "--port", str(ui_port), "--strictPort"],
                ui,
            ),
        ]:
            log = (logs / f"{name}.log").open("w")
            files.append(log)
            p = subprocess.Popen(
                command,
                cwd=ROOT,
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=os.name == "posix",
            )
            children.append(p)
            wait(url, p)
        env["E2E_OPERATOR_PASSWORD"] = env["AQUATWIN_OPERATOR_PASSWORD"]
        env["E2E_PYTHON"] = sys.executable
        subprocess.run([npm, "run", "test:e2e"], cwd=ROOT, env=env, check=True)
    finally:
        for p in reversed(children):
            if p.poll() is None:
                if os.name == "posix":
                    os.killpg(p.pid, signal.SIGTERM)
                else:
                    p.terminate()
                try:
                    p.wait(timeout=8)
                except subprocess.TimeoutExpired:
                    if os.name == "posix":
                        os.killpg(p.pid, signal.SIGKILL)
                    else:
                        p.kill()
                    p.wait()
        for f in files:
            f.close()
    print("All local validation checks passed; validation servers stopped.")


if __name__ == "__main__":
    main()
