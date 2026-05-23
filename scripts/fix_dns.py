#!/usr/bin/env python3
import json, urllib.request

CF_TOKEN = "REDACTED_CF_API_TOKEN"
CF_ZONE  = "REDACTED_CF_ZONE_ID"
APEX_CNAME_ID = "REDACTED_CF_APEX_RECORD_ID"
WWW_CNAME_ID  = "REDACTED_CF_WWW_RECORD_ID"
GOOGLE_IPS = ["216.239.32.21","216.239.34.21","216.239.36.21","216.239.38.21"]

BASE = f"https://api.cloudflare.com/client/v4/zones/{CF_ZONE}/dns_records"
HEADERS = {"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"}

def cf(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(BASE + path, data=data, headers=HEADERS, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Step 1: Update www CNAME to ghs.googlehosted.com, proxied=false
print("Step 1: Updating www CNAME → ghs.googlehosted.com (DNS-only) ...")
r = cf("PATCH", f"/{WWW_CNAME_ID}", {"type":"CNAME","name":"www","content":"ghs.googlehosted.com","proxied":False,"ttl":1})
print(f"  success: {r['success']}  errors: {r.get('errors')}")

# Step 2: Delete apex CNAME
print("\nStep 2: Deleting apex CNAME ...")
r = cf("DELETE", f"/{APEX_CNAME_ID}")
print(f"  success: {r['success']}  errors: {r.get('errors')}")

# Step 3: Add apex A records, proxied=false
print("\nStep 3: Adding apex A records (DNS-only) ...")
for ip in GOOGLE_IPS:
    r = cf("POST", "", {"type":"A","name":"agenthivehq.com","content":ip,"proxied":False,"ttl":1})
    print(f"  A {ip} → success: {r['success']}  errors: {r.get('errors')}")

# Summary
print("\n=== Final DNS records (A + CNAME) ===")
r = cf("GET", "?type=A,CNAME&per_page=50")
for rec in r.get("result", []):
    print(f"  {rec['type']:5} {rec['name']:30} → {rec['content']:45} proxied={rec.get('proxied')}")

print("\nDone! Google will retry certificate provisioning within ~15 min.")
print("Site will be live at https://agenthivehq.com once cert is issued.")
