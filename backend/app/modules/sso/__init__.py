"""SSO module — enterprise single sign-on (SAML/OIDC) via WorkOS.

Activates when WORKOS_API_KEY + WORKOS_CLIENT_ID are set. Until then, the
endpoints return 503 with a clear "not configured" message so the frontend can
hide the SSO option gracefully.
"""
