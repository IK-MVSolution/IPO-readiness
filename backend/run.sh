#!/bin/sh
# รัน Backend (ใช้ python3 หรือ Python ใน .venv)
cd "$(dirname "$0")"
if [ -x .venv/bin/python ]; then
  exec .venv/bin/python app.py
fi
exec python3 app.py
