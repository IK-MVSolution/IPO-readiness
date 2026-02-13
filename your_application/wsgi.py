# When Render runs from repo root (no Root Directory), gunicorn your_application.wsgi
# loads this file. We add backend to path and expose the Flask app.
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(_backend))

from app import app

application = app
