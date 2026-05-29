"""PyInstaller entry point for Lumi Server."""
import sys
import threading
import webbrowser
import uvicorn

# Ensure the project root is on sys.path for development
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.main import app


def main():
    port = 8000
    no_browser = False
    # Parse args
    for i, arg in enumerate(sys.argv):
        if arg == '--port' and i + 1 < len(sys.argv):
            port = int(sys.argv[i + 1])
        if arg == '--no-browser':
            no_browser = True

    if not no_browser:
        def _open():
            import time
            time.sleep(1.5)
            webbrowser.open(f'http://127.0.0.1:{port}/login')
        threading.Thread(target=_open, daemon=True).start()

    uvicorn.run(app, host='127.0.0.1', port=port)


if __name__ == '__main__':
    main()
