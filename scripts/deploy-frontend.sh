#!/usr/bin/env bash
# =============================================================================
# deploy-frontend.sh — Manual Cloud Build submit for AgentHive frontend
#
# Usage:
#   1. Copy .env.deploy.example → .env.deploy and fill in real values (once).
#   2. Run:  bash scripts/deploy-frontend.sh
#
# No Cloud Build Trigger is required. This runs `gcloud builds submit` with
# all substitution variables passed explicitly, bypassing the "placeholder"
# defaults in cloudbuild-frontend.yaml.
#
# Requirements:  gcloud CLI authenticated + project set, Docker not needed
#                (Cloud Build does the build remotely).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.deploy"

# ── Load .env.deploy if it exists ─────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading credentials from .env.deploy ..."
  # Export every non-comment, non-blank line
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo ""
  echo "ERROR: $ENV_FILE not found."
  echo "Copy .env.deploy.example → .env.deploy and fill in your Firebase credentials."
  echo ""
  exit 1
fi

# ── Validate required vars ────────────────────────────────────────────────────
REQUIRED_VARS=(
  FIREBASE_API_KEY
  FIREBASE_AUTH_DOMAIN
  FIREBASE_PROJECT_ID
  FIREBASE_STORAGE_BUCKET
  FIREBASE_SENDER_ID
  FIREBASE_APP_ID
  API_BASE_URL
  GCP_PROJECT
)

MISSING=0
for VAR in "${REQUIRED_VARS[@]}"; do
  VAL="${!VAR:-}"
  if [[ -z "$VAL" || "$VAL" == "placeholder" ]]; then
    echo "ERROR: $VAR is not set or is still 'placeholder' in .env.deploy"
    MISSING=1
  fi
done
[[ $MISSING -eq 1 ]] && exit 1

DEMO_MODE="${DEMO_MODE_DEFAULT:-false}"

# ── Resolve git commit SHA for image tagging ──────────────────────────────────
COMMIT_SHA=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "manual")
echo ""
echo "Deploying frontend @ commit $COMMIT_SHA"
echo "GCP project : $GCP_PROJECT"
echo "API base URL: $API_BASE_URL"
echo ""

# ── Submit to Cloud Build ─────────────────────────────────────────────────────
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud builds submit "$ROOT_DIR" \
  --config="$ROOT_DIR/cloudbuild-frontend.yaml" \
  --project="$GCP_PROJECT" \
  --substitutions=\
"_FIREBASE_API_KEY=${FIREBASE_API_KEY},\
_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN},\
_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID},\
_FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET},\
_FIREBASE_SENDER_ID=${FIREBASE_SENDER_ID},\
_FIREBASE_APP_ID=${FIREBASE_APP_ID},\
_API_BASE_URL=${API_BASE_URL},\
_DEMO_MODE_DEFAULT=${DEMO_MODE},\
_COMMIT_SHA=${COMMIT_SHA}"

echo ""
echo "✓ Deploy submitted. Monitor progress at:"
echo "  https://console.cloud.google.com/cloud-build/builds?project=$GCP_PROJECT"
