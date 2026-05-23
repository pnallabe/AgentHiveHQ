#!/bin/bash
# Start AgentHiveHQ backend on port 8000
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
VENV="$BACKEND_DIR/.venv"

cd "$BACKEND_DIR"

# Load env
set -a
source "$ENV_FILE"
set +a

exec "$VENV/bin/python" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
