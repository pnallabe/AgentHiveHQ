"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Tenant = "lending_club" | "synthetic_tenant_a" | "synthetic_tenant_b";

interface TenantContextType {
  tenant: Tenant;
  setTenant: (tenant: Tenant) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant>("lending_club");

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agenthivehq_tenant");
      if (saved) {
        setTenant(saved as Tenant);
      }
    } catch {}
  }, []);

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem("agenthivehq_tenant", tenant);
    } catch {}
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, setTenant }}>
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
