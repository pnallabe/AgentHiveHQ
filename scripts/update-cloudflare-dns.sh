#!/usr/bin/env bash
set -euo pipefail

CF_TOKEN="REDACTED_CF_API_TOKEN"
CF_ZONE="REDACTED_CF_ZONE_ID"
CR_HOST="agenthivehq-frontend-2rsbib2n4q-uc.a.run.app"

# Delete old A record for apex
echo "Deleting old apex A record..."
curl -s -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/REDACTED_CF_RECORD_ID_1" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  success:', d.get('success'), d.get('errors',''))"

# Delete old www CNAME (certificate-manager verification record)
echo "Deleting old www CNAME..."
curl -s -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/REDACTED_CF_RECORD_ID_2" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  success:', d.get('success'), d.get('errors',''))"

# Create CNAME for apex — Cloudflare flattens this to A records automatically
echo "Creating apex CNAME → ${CR_HOST} ..."
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"agenthivehq.com\",\"content\":\"${CR_HOST}\",\"proxied\":true,\"ttl\":1}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',{}); print('  success:', d.get('success'), '| target:', r.get('content'), d.get('errors',''))"

# Create CNAME for www
echo "Creating www CNAME → ${CR_HOST} ..."
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"www\",\"content\":\"${CR_HOST}\",\"proxied\":true,\"ttl\":1}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',{}); print('  success:', d.get('success'), '| target:', r.get('content'), d.get('errors',''))"

echo ""
echo "Done. Traffic flow: agenthivehq.com → Cloudflare proxy → Cloud Run (agenthivehq-frontend)"
echo "SSL is handled by Cloudflare — no certificate provisioning needed."
