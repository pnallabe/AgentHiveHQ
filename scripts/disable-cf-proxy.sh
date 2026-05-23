#!/usr/bin/env bash
set -euo pipefail

CF_TOKEN="REDACTED_CF_API_TOKEN"
CF_ZONE="REDACTED_CF_ZONE_ID"
CR_HOST="agenthivehq-frontend-2rsbib2n4q-uc.a.run.app"
APEX_ID="REDACTED_CF_APEX_RECORD_ID"
WWW_ID="REDACTED_CF_WWW_RECORD_ID"

echo "Setting apex CNAME to DNS-only (proxied: false)..."
curl -s -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${APEX_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"proxied\":false}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  success:', d.get('success'), d.get('errors',''))"

echo "Setting www CNAME to DNS-only (proxied: false)..."
curl -s -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${WWW_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"proxied\":false}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  success:', d.get('success'), d.get('errors',''))"

echo ""
echo "Done. Traffic now: agenthivehq.com --DNS--> Cloud Run (TLS handled by GCP)"
