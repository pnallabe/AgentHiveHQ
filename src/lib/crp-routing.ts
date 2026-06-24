import type { User } from "firebase/auth";

const DEFAULT_CRP_BASE_URL = "http://localhost:3005";
const DEFAULT_API_URL = "http://localhost:8001";
const LOOP_WINDOW_MS = 15_000;

/**
 * Exchange a Firebase ID token for a Helix HS256 tenant token by calling the
 * tenant-portal's /api/auth/firebase bridge endpoint.  Returns the tenantSlug
 * on success, null on failure (the rest of the login flow will fall back to
 * JWT-claim resolution).
 */
async function exchangeFirebaseTokenForHelixSession(
  idToken: string,
  crpBaseUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(`${crpBaseUrl}/api/auth/firebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.user?.tenant_slug) {
      if (typeof window !== "undefined") {
        localStorage.setItem("helix_tenant_token", data.token);
        localStorage.setItem("helix_tenant_id", data.user.email ?? "");
        localStorage.setItem("helix_tenant_slug", data.user.tenant_slug);
        localStorage.setItem("helix_tenants", JSON.stringify([data.user.tenant_slug]));
      }
      return data.user.tenant_slug as string;
    }
    return null;
  } catch {
    return null;
  }
}

type TenantLike = string | { slug?: string; tenantSlug?: string; tenant_id?: string; tenantId?: string; id?: string };

function canonicalizeTenantSlug(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function tenantFromMembership(item: TenantLike): string {
  if (typeof item === "string") {
    return canonicalizeTenantSlug(item);
  }
  return canonicalizeTenantSlug(item.slug ?? item.tenantSlug ?? item.tenant_id ?? item.tenantId ?? item.id);
}

export function sanitizeNextPath(nextPath: string | null | undefined): string {
  if (!nextPath) return "/dashboard";

  const candidate = nextPath.trim();
  if (!candidate.startsWith("/")) return "/dashboard";
  if (candidate.startsWith("//")) return "/dashboard";

  try {
    const parsed = new URL(candidate, "http://localhost");
    if (parsed.origin !== "http://localhost") return "/dashboard";

    if (parsed.pathname.startsWith("/t/")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 3) {
        return `/${parts.slice(2).join("/")}`;
      }
      return "/dashboard";
    }

    if (parsed.pathname.startsWith("/reports")) return "/reports";
    if (parsed.pathname.startsWith("/settings")) return "/settings";
    if (parsed.pathname.startsWith("/dashboard")) return "/dashboard";
  } catch {
    return "/dashboard";
  }

  return "/dashboard";
}

function normalizeTenantPath(nextPath: string | null | undefined): string {
  const safe = sanitizeNextPath(nextPath);
  if (safe.startsWith("/reports")) return "/reports";
  if (safe.startsWith("/settings")) return "/settings";
  return "/dashboard";
}

export function resolvePrimaryTenant(
  claims: Record<string, unknown> | null | undefined,
  emailFallback?: string | null
): string | null {
  const direct = canonicalizeTenantSlug(
    typeof claims?.tenantSlug === "string"
      ? claims.tenantSlug
      : typeof claims?.tenant_slug === "string"
        ? claims.tenant_slug
        : typeof claims?.tenantId === "string"
          ? claims.tenantId
          : typeof claims?.tenant_id === "string"
            ? claims.tenant_id
            : undefined
  );
  if (direct) return direct;

  const tenants = claims?.tenants;
  if (Array.isArray(tenants) && tenants.length > 0) {
    const tenant = tenantFromMembership(tenants[0] as TenantLike);
    if (tenant) return tenant;
  }

  const email = (emailFallback ?? "").toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const domainMap: Record<string, string> = {
    "prosper.com": "prosper",
    "lendingclub.com": "lending-club",
    "freddiemac.com": "freddie-mac",
  };
  if (domainMap[domain]) return domainMap[domain];

  return null;
}

function getCrpBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CREDIT_RISK_PLATFORM_URL;
  return configured && configured.trim().length > 0 ? configured : DEFAULT_CRP_BASE_URL;
}

function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  return configured && configured.trim().length > 0 ? configured : DEFAULT_API_URL;
}

export interface TenantMembership {
  tenantSlug: string;
  status: string;
  role: string;
}

/**
 * Fetch tenant memberships for the authenticated user from the CRP backend.
 * Returns an empty array on 401/403 or network errors (never throws).
 * Structured errors are logged for observability.
 */
export async function fetchTenantMemberships(idToken: string): Promise<TenantMembership[]> {
  const endpoint = `${getApiBaseUrl()}/api/v1/tenants/me`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      console.error("fetchTenantMemberships: non-OK response", {
        endpoint,
        statusCode: res.status,
      });
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? (data as TenantMembership[]) : [];
  } catch (err) {
    console.error("fetchTenantMemberships: request failed", { endpoint, err });
    return [];
  }
}

function shouldBlockLoop(target: string): boolean {
  if (typeof window === "undefined") return false;

  const previousRaw = window.sessionStorage.getItem("crp_bridge_state");
  if (!previousRaw) return false;

  try {
    const previous = JSON.parse(previousRaw) as { target: string; ts: number };
    const withinWindow = Date.now() - previous.ts < LOOP_WINDOW_MS;
    return withinWindow && previous.target === target;
  } catch {
    return false;
  }
}

function setBridgeState(target: string): string {
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      "crp_bridge_state",
      JSON.stringify({ target, ts: Date.now(), marker })
    );
  }
  return marker;
}

export async function buildCrpTenantUrlForUser(user: User, nextPath?: string | null): Promise<string | null> {
  const idToken = await user.getIdToken();
  const crpBase = getCrpBaseUrl();

  // 1. Try the Firebase bridge (issues a Helix HS256 cookie + persists to localStorage)
  let tenantSlug: string | null = await exchangeFirebaseTokenForHelixSession(idToken, crpBase);

  // 2. Fall back to API membership lookup
  if (!tenantSlug) {
    const memberships = await fetchTenantMemberships(idToken);
    if (memberships.length > 0) {
      const active = memberships.find((m) => m.status === "active") ?? memberships[0];
      tenantSlug = canonicalizeTenantSlug(active.tenantSlug);
    }
  }

  // 3. Fall back to JWT claims
  if (!tenantSlug) {
    const tokenResult = await user.getIdTokenResult();
    tenantSlug = resolvePrimaryTenant(tokenResult.claims as Record<string, unknown>, user.email);
  }

  if (!tenantSlug) {
    return null;
  }

  const baseUrl = new URL(crpBase);
  const normalizedPath = normalizeTenantPath(nextPath);
  baseUrl.pathname = `/t/${tenantSlug}${normalizedPath}`;
  const bridge = setBridgeState(baseUrl.pathname);
  baseUrl.searchParams.set("bridge", bridge);
  return baseUrl.toString();
}

export async function redirectUserToCrp(user: User, nextPath?: string | null): Promise<boolean> {
  const target = await buildCrpTenantUrlForUser(user, nextPath);
  if (!target) {
    return false;
  }

  if (shouldBlockLoop(new URL(target).pathname)) {
    return false;
  }

  if (typeof window !== "undefined") {
    window.location.assign(target);
    return true;
  }

  return false;
}
