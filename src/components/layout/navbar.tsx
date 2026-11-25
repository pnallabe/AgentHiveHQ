"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Menu, LogOut, LogIn, TrendingUp } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/shared/Logo";
import { DemoModeToggle } from "@/components/lab/DemoModeToggle";
import { redirectUserToCrp } from "@/lib/crp-routing";

// ── Nav link definitions ─────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/#products",     label: "Products"       },
  { href: "/#how-it-works", label: "Platform"       },
  { href: "/engineering",   label: "Engineering"    },
  { href: "/about",         label: "About Us"       },
  { href: "/case-studies",  label: "Case Studies"   },
  { href: "/showcase",      label: "Showcase"       },
  { href: "/#pricing",      label: "Pricing"        },
  { href: "/tenant-portal", label: "Tenant Portal"  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled,    setScrolled]   = React.useState(false);

  // Glassmorphism activates on scroll
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out", description: "You have been signed out." });
      router.push("/");
    } catch {
      toast({ title: "Logout failed", variant: "destructive" });
    }
    setMobileOpen(false);
  };

  const handleCrpNavigation = async (nextPath: "/dashboard" | "/reports" | "/settings") => {
    if (!user) return;

    const redirected = await redirectUserToCrp(user, nextPath);
    if (!redirected) {
      toast({
        title: "Tenant routing unavailable",
        description: "Your account does not have an active tenant mapping.",
        variant: "destructive",
      });
    }
    setMobileOpen(false);
  };

  const isActive = (href: string) => {
    if (href.startsWith("/#")) return pathname === "/";
    return pathname.startsWith(href);
  };

  const desktopLinks = (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary navigation">
      {NAV_LINKS.map((l) => (
        <Link
          key={l.label}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            isActive(l.href)
              ? "text-zinc-100 font-medium"
              : "text-zinc-400 hover:text-zinc-100"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-14 w-full transition-all duration-300",
        scrolled
          ? "border-b border-surface-border bg-surface-base/80 backdrop-blur-md"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left — Logo */}
        <Logo />

        {/* Center — Desktop nav */}
        {desktopLinks}

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          {/* DemoModeToggle is only visible inside /lab – rendered here for global access */}
          <div className="hidden md:block">
            {pathname.startsWith("/lab") && <DemoModeToggle />}
          </div>

          {!loading && (
            <>
              {user ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden text-zinc-400 hover:text-zinc-100 md:inline-flex"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
                    Logout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden text-zinc-400 hover:text-zinc-100 md:inline-flex gap-1.5"
                    onClick={() => handleCrpNavigation("/reports")}
                  >
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    Analytics
                  </Button>
                  <Button
                    size="sm"
                    className="hidden bg-brand-500 hover:bg-brand-600 text-white md:inline-flex"
                    onClick={() => handleCrpNavigation("/dashboard")}
                  >
                    Tenant Portal
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="hidden text-zinc-400 hover:text-zinc-100 md:inline-flex"
                  >
                    <Link href="/login">
                      <LogIn className="mr-1.5 h-4 w-4" aria-hidden />
                      Log In
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="hidden bg-brand-500 hover:bg-brand-600 text-white px-4 md:inline-flex"
                  >
                    <Link href="/signup">Get Access</Link>
                  </Button>
                </>
              )}
            </>
          )}

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] bg-surface-overlay border-l border-surface-border p-6 flex flex-col"
              >
                <SheetTitle className="sr-only">Main Menu</SheetTitle>
                <div className="mb-6">
                  <Logo />
                </div>
                <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
                  {NAV_LINKS.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-base transition-colors",
                        isActive(l.href)
                          ? "bg-brand-950 text-brand-300 font-medium"
                          : "text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                      )}
                    >
                      {l.label}
                    </Link>
                  ))}
                  {user && (
                    <button
                      type="button"
                      onClick={() => handleCrpNavigation("/reports")}
                      className={cn(
                        "rounded-lg px-3 py-2.5 text-base transition-colors flex items-center gap-2",
                        isActive("/analytics")
                          ? "bg-brand-950 text-brand-300 font-medium"
                          : "text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                      )}
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden />
                      Analytics
                    </button>
                  )}
                </nav>
                <div className="mt-auto space-y-2 pt-6 border-t border-surface-border">
                  {!loading && (
                    user ? (
                      <Button
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full border-surface-border"
                        size="lg"
                      >
                        <LogOut className="mr-2 h-4 w-4" aria-hidden />
                        Logout
                      </Button>
                    ) : (
                      <>
                        <Button
                          asChild
                          className="w-full bg-brand-500 hover:bg-brand-600 text-white"
                          size="lg"
                          onClick={() => setMobileOpen(false)}
                        >
                          <Link href="/signup">Get Access</Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          className="w-full border-surface-border"
                          size="lg"
                          onClick={() => setMobileOpen(false)}
                        >
                          <Link href="/login">Log In</Link>
                        </Button>
                      </>
                    )
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
