#!/usr/bin/env bash
set -euo pipefail

CF_TOKEN="REDACTED_CF_API_TOKEN"
CF_ZONE="REDACTED_CF_ZONE_ID"
APEX_ID="REDACTED_CF_APEX_RECORD_ID"
WWW_ID="REDACTED_CF_WWW_RECORD_ID"

# Google-provided IPs from Cloud Run domain mapping
GOOGLE_IPS=(216.239.32.21 216.239.34.21 216.239.36.21 216.239.38.21)

echo "=== Step 1: Update www CNAME → ghs.googlehosted.com (DNS-only) ==="
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${WWW_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"www","content":"ghs.googlehosted.com","proxied":false,"ttl":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  success:', d.get('success'), d.get('errors'))"

echo ""
echo "=== Step 2: Delete apex CNAME ==="
curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${APEX_ID}" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  delete success:', d.get('success'), d.get('errors'))"

echo ""
echo "=== Step 3: Add apex A records (DNS-only, no proxy) ==="
for IP in "${GOOGLE_IPS[@]}"; do
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records" \
    -H "Authorization: Bearer ${CF_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"A\",\"name\":\"agenthivehq.com\",\"content\":\"${IP}\",\"proxied\":false,\"ttl\":1}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('result',{}); print('  A $IP → success:', d.get('success'), d.get('errors'))"
done

echo ""
echo "=== DNS updated! ==="
echo "Google Cloud Run will now retry TLS certificate provisioning."
echo "The site should come up within ~15-30 minutes."
echo ""
echo "Final DNS state:"
curl -s "https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?type=A,CNAME" \
  -H "Authorization: Bearer ${CF_TOKEN}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(' ', r['type'], r['name'], '->', r['content'], '(proxied:', str(r.get('proxied','?')) + ')') for r in d.get('result',[]) if r['type'] in ('A','CNAME')]"
