#!/bin/bash
# Start AgentHiveHQ Next.js frontend
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.local"

cd "$SCRIPT_DIR"

# Load env vars
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Use NEXT_PUBLIC_API_URL pointing to AgentHiveHQ backend
export NEXT_PUBLIC_API_URL="http://localhost:8000"

exec npm run dev -- --port 9002
