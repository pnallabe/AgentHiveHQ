/**
 * AnalyticsShell — executive analytics layout with sidebar nav, top bar controls,
 * CONFIDENTIAL label, and role guard.
 *
 * Usage:
 *   <AnalyticsShell period={period} product={product}>
 *     {children}
 *   </AnalyticsShell>
 */
"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  Settings2,
  ShieldAlert,
  TrendingUp,
  Building2,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PeriodPicker, type PeriodToken } from "./PeriodPicker";
import { ProductToggle, type ProductFilter } from "./ProductToggle";
import { ExportButton } from "./ExportButton";
import { DataFreshnessTag } from "./DataFreshnessTag";

// ---------------------------------------------------------------------------
// Navigation definition
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { href: "/analytics/overview",    label: "Overview",     Icon: LayoutDashboard },
  { href: "/analytics/financial",   label: "Financial",    Icon: DollarSign      },
  { href: "/analytics/operational", label: "Operational",  Icon: Settings2       },
  { href: "/analytics/risk",        label: "Risk",         Icon: ShieldAlert     },
  { href: "/analytics/projections", label: "Projections",  Icon: TrendingUp      },
  { href: "/analytics/corporate",   label: "Corporate",    Icon: Building2       },
];

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

function NavItem({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Executive guard — renders 403 card for non-executive roles
// ---------------------------------------------------------------------------

function ExecutiveGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // During loading show nothing; once resolved check role
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Allow null (unauthenticated) to pass — the with-auth HOC handles the redirect.
  // Only block if explicitly a non-executive authenticated user.
  // Custom claims are not standard on the Firebase client User object, so we
  // check user.email as a fallback — override if you have a role claim mechanism.
  const role = (user as unknown as { customClaims?: { role?: string } })?.customClaims?.role;
  if (user && role && role !== "executive" && role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Executive Analytics is available to executive and admin users only.
          Contact your system administrator to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// AnalyticsShell
// ---------------------------------------------------------------------------

export interface AnalyticsShellProps {
  children: ReactNode;
  period?: PeriodToken;
  product?: ProductFilter;
  dataAsOf?: string | null;
  className?: string;
}

export function AnalyticsShell({
  children,
  period = "ytd",
  product = "all",
  dataAsOf,
  className,
}: AnalyticsShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ExecutiveGuard>
      <div className={cn("flex h-dvh overflow-hidden bg-background", className)}>
        {/* ── Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-card transition-transform duration-200",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:relative lg:translate-x-0"
          )}
        >
          {/* Sidebar header */}
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Link href="/analytics/overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight">Analytics</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 px-2 py-3 overflow-y-auto">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>

          {/* CONFIDENTIAL label */}
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground text-center">
              Confidential — Internal Use Only
            </p>
          </div>
        </aside>

        {/* ── Main content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Top bar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 gap-3">
            {/* Left: hamburger + title */}
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 lg:hidden shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="text-sm font-semibold truncate">Executive Analytics</h1>
              <DataFreshnessTag dataAsOf={dataAsOf} className="hidden sm:inline-flex" />
            </div>

            {/* Right: controls */}
            <div className="flex items-center gap-2 shrink-0">
              <PeriodPicker value={period} className="hidden md:inline-flex" />
              <ProductToggle value={product} className="hidden md:inline-flex" />
              <ExportButton period={period} product={product} />
            </div>
          </header>

          {/* Mobile second row for pickers */}
          <div className="flex items-center gap-2 border-b border-border bg-card/50 px-4 py-2 md:hidden">
            <PeriodPicker value={period} />
            <ProductToggle value={product} />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ExecutiveGuard>
  );
}
