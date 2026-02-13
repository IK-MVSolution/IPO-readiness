# Render default start command is "gunicorn your_application.wsgi".
# This exposes our Flask app so that command works when Root Directory = backend.
from app import app

application = app
