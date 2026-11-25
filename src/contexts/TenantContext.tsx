"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "@/contexts/auth-context";

// ---------------------------------------------------------------------------
// Types — mirror GET /api/v1/me
// ---------------------------------------------------------------------------

export type TenantRole = "admin" | "risk_manager" | "underwriter" | "auditor";

export interface TenantInfo {
  id: string;
  slug: string;
  display_name: string;
  plan: string;
  role: TenantRole;
}

interface TenantContextType {
  /** Resolved tenant, or null when the user is unlinked / signed out. */
  tenant: TenantInfo | null;
  /** True while the /api/v1/me request is in flight. */
  loading: boolean;
  /** True when signed in but not linked to any tenant. */
  isUnlinked: boolean;
  /** Re-fetch tenant context (e.g. after provisioning). */
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    // Signed out → no tenant.
    if (!user) {
      setTenant(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setTenant(null);
        return;
      }
      const data = await res.json();
      setTenant(data.tenant ?? null);
    } catch (err) {
      console.error("[tenant] failed to resolve tenant context", err);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Wait for Firebase auth to settle before resolving tenant.
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  const isUnlinked = !authLoading && !loading && !!user && tenant === null;

  return (
    <TenantContext.Provider value={{ tenant, loading, isUnlinked, refresh }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
