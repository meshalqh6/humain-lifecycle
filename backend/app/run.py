"""Local runner with a private filesystem shutdown signal for Windows."""

import threading
from pathlib import Path
import uvicorn

signal_file = Path(__file__).resolve().parents[2] / "runtime" / "shutdown.request"
signal_file.unlink(missing_ok=True)
server = uvicorn.Server(uvicorn.Config("app.main:app", host="127.0.0.1", port=8000, timeout_graceful_shutdown=20))
done = threading.Event()


def watch():
    while not done.wait(0.5):
        if signal_file.exists():
            server.should_exit = True
            return


if __name__ == "__main__":
    threading.Thread(target=watch, daemon=True).start()
    try:
        server.run()
    finally:
        done.set()
        signal_file.unlink(missing_ok=True)
