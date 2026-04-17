#!/bin/sh
# Railway injects $PORT — fall back to 8000 for local dev
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 2
