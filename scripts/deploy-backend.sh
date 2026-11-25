#!/usr/bin/env bash
# =============================================================================
# deploy-backend.sh — Manual Cloud Build submit for the AgentHive FastAPI backend
#
# Usage:
#   1. Copy .env.deploy.example → .env.deploy and fill in values (once).
#   2. Run:  bash scripts/deploy-backend.sh
#
# No Cloud Build Trigger is required. This runs `gcloud builds submit` with
# all substitution variables passed explicitly.
#
# Requirements:  gcloud CLI authenticated + project set. Docker is NOT needed
#                locally — Cloud Build builds remotely.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.deploy"

# ── Load .env.deploy if it exists ─────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading config from .env.deploy ..."
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ── Config (with sensible defaults) ───────────────────────────────────────────
GCP_PROJECT="${GCP_PROJECT:-agenthivehq-landing}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-agenthivehq-backend-api}"

# NOTE: DATABASE_URL and ALLOWED_ORIGINS are set in cloudbuild-backend.yaml
# (they contain commas, which break gcloud --substitutions parsing). Edit the
# YAML to change them. Default is ephemeral SQLite — data resets on redeploy.

# ── Resolve git commit SHA for image tagging ──────────────────────────────────
COMMIT_SHA=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "manual")

echo ""
echo "Deploying backend @ commit $COMMIT_SHA"
echo "GCP project : $GCP_PROJECT"
echo "Service     : $SERVICE_NAME ($REGION)"
echo "  (DATABASE_URL + ALLOWED_ORIGINS are set in cloudbuild-backend.yaml)"
echo ""

# ── Submit to Cloud Build ─────────────────────────────────────────────────────
# Only comma-free values are passed as substitutions.
gcloud builds submit "$ROOT_DIR" \
  --project="$GCP_PROJECT" \
  --config="$ROOT_DIR/cloudbuild-backend.yaml" \
  --substitutions="_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME,_COMMIT_SHA=$COMMIT_SHA"

echo ""
echo "✓ Backend deployed."
echo "  Service URL: https://$SERVICE_NAME-311931689095.$REGION.run.app"
echo "  Health check: curl https://$SERVICE_NAME-311931689095.$REGION.run.app/api/health"
