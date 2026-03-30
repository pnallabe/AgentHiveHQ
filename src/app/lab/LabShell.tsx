"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  MessageSquare,
  BarChart3,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  LogOut,
  Plug,
} from "lucide-react";
import { useState } from "react";
import { withAuth } from "@/components/layout/with-auth";
import { DemoModeProvider } from "@/contexts/demo-mode-context";
import { DemoModeToggle } from "@/components/lab/DemoModeToggle";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const PRODUCT_NAV = [
  { href: "/lab/underwriting",  label: "Underwriting Engine",    Icon: BrainCircuit  },
  { href: "/lab/copilot",       label: "AI Copilot",            Icon: MessageSquare },
  { href: "/lab/governance",    label: "Governance Suite",      Icon: BarChart3     },
  { href: "/lab/integrations",  label: "Integration Gateway",   Icon: Plug          },
];

const PLATFORM_NAV = [
  { href: "/case-studies", label: "Case Studies", Icon: BookOpen },
];

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.replace(/^\/lab\/?/, "").split("/").filter(Boolean);

  const crumbs: { label: string; href: string }[] = [
    { label: "Product Lab", href: "/lab" },
  ];

  const SEGMENT_LABELS: Record<string, string> = {
    underwriting: "Underwriting Engine",
    copilot:      "AI Copilot",
    governance:   "Governance Suite",
  };

  for (const seg of segments) {
    crumbs.push({ label: SEGMENT_LABELS[seg] ?? seg, href: `/lab/${seg}` });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" aria-hidden />}
            {isLast ? (
              <span className="font-medium text-zinc-100">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// NavItem — uses border-l active indicator
// ---------------------------------------------------------------------------

function NavItem({
  href,
  label,
  Icon,
  onClick,
}: { href: string; label: string; Icon: React.ElementType; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-r-lg border-l-2 py-2 pl-4 pr-3 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        isActive
          ? "border-brand-500 bg-brand-950/60 font-medium text-brand-300"
          : "border-transparent text-zinc-400 hover:bg-surface-overlay hover:text-zinc-200"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// NavSection — label + items
// ---------------------------------------------------------------------------

function NavSection({
  heading,
  items,
  onClick,
}: {
  heading: string;
  items: typeof PRODUCT_NAV;
  onClick?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      <p className="mb-1 pl-6 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        {heading}
      </p>
      {items.map((item) => (
        <NavItem key={item.href} {...item} onClick={onClick} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner shell
// ---------------------------------------------------------------------------

function LabShellInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "AH";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center px-5 py-4">
        <Logo href="/" size={28} showWordmark />
      </div>

      {/* Demo mode toggle */}
      <div className="px-4 pb-3">
        <DemoModeToggle />
      </div>

      {/* Border separator */}
      <div className="mx-4 border-t border-surface-border" />

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-0 py-4" aria-label="Lab navigation">
        <NavSection heading="Product Lab" items={PRODUCT_NAV} onClick={closeSidebar} />
        <NavSection heading="Platform"    items={PLATFORM_NAV} onClick={closeSidebar} />
      </nav>

      {/* Border separator */}
      <div className="mx-4 border-t border-surface-border" />

      {/* User footer */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-brand-300">
          {initials}
        </div>
        <p className="min-w-0 flex-1 truncate text-xs text-zinc-400">{user?.email}</p>
        <button
          onClick={logout}
          aria-label="Sign out"
          className="rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-surface-base text-zinc-100">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-surface-border bg-surface-raised md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex-col border-r border-surface-border bg-surface-raised transition-transform duration-200 md:hidden",
          sidebarOpen ? "flex translate-x-0" : "-translate-x-full"
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-end p-3">
          <button
            onClick={closeSidebar}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-surface-border bg-surface-base/80 px-4 py-3 backdrop-blur-sm md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Breadcrumb />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export const LabShell = withAuth(function LabShellWithDemo({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DemoModeProvider>
      <LabShellInner>{children}</LabShellInner>
    </DemoModeProvider>
  );
});
