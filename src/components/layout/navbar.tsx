
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"; // Added SheetTitle
import { Menu, RocketIcon, LogOut, LayoutDashboard, LogIn } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";


const navLinksBase = [
  { href: "/#home", label: "Home", public: true },
  { href: "/#about", label: "About", public: true },
  { href: "/#products", label: "Products", public: true },
  { href: "/#rulesense-highlight", label: "RuleSense AI", public: true }, // Updated label for clarity
  { href: "/#contact", label: "Contact", public: true },
];

const navLinksAuth = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push("/"); // Redirect to home after logout
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Could not log you out. Please try again.",
        variant: "destructive",
      });
    }
    setMobileMenuOpen(false);
  };

  const renderNavLinks = (isMobile: boolean = false) => {
    const linksToRender = [...navLinksBase];
    if (user) {
        // If user is logged in, no need for "Get Started" that links to #contact.
        // Instead, dashboard is primary CTA.
    }

    return linksToRender.map((link) => (
      <Button
        key={link.label}
        variant="link"
        asChild
        className={cn(
          "text-sm font-medium",
          isMobile ? "text-foreground hover:text-primary w-full justify-start py-3 text-base" : "text-muted-foreground hover:text-foreground",
          (pathname === link.href || (pathname === '/' && link.href === '/#home')) && (isMobile ? "text-primary font-semibold" : "text-foreground font-semibold")
        )}
        onClick={() => isMobile && setMobileMenuOpen(false)}
      >
        <Link href={link.href}>{link.label}</Link>
      </Button>
    ));
  };


  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isScrolled ? "border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md" : "bg-transparent"
    )}>
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={user ? "/dashboard" : "/#home"} className="flex items-center gap-2" onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
          <RocketIcon className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">AgentHiveHQ</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-1 md:flex">
          {renderNavLinks()}
          {!loading && user && navLinksAuth.map((link) => (
            <Button key={link.label} variant="link" asChild className={cn("text-sm font-medium text-muted-foreground hover:text-foreground", pathname === link.href && "text-foreground font-semibold")}>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {!loading && user ? (
            <>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="hidden md:inline-flex">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
               <Button asChild className="hidden md:inline-flex" variant="default">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : !loading ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild className="hidden md:inline-flex">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          ) : (
             <div className="h-8 w-20 hidden md:block"></div> // Placeholder for loading state to prevent layout shift
          )}
          <ThemeToggleButton />
          <div className="md:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] p-6 flex flex-col">
                <SheetTitle className="sr-only">Main Menu</SheetTitle> {/* Added visually hidden title */}
                <div className="mb-6 flex items-center gap-2">
                    <RocketIcon className="h-7 w-7 text-primary" />
                    <span className="text-xl font-bold text-foreground">AgentHiveHQ</span>
                </div>
                <nav className="flex flex-col space-y-1">
                  {renderNavLinks(true)}
                   {!loading && user && navLinksAuth.map((link) => (
                    <Button
                      key={link.label}
                      variant="link"
                      asChild
                      className={cn("text-base font-medium text-foreground hover:text-primary w-full justify-start py-3", pathname === link.href && "text-primary font-semibold")}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Link href={link.href}><link.icon className="mr-2 h-5 w-5" />{link.label}</Link>
                    </Button>
                  ))}
                </nav>
                <div className="mt-auto space-y-3 pt-6">
                  {!loading && user ? (
                    <Button onClick={handleLogout} variant="outline" className="w-full" size="lg">
                      <LogOut className="mr-2 h-5 w-5" /> Logout
                    </Button>
                  ) : !loading ? (
                    <>
                      <Button asChild className="w-full" size="lg" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/signup">Sign Up</Link>
                      </Button>
                       <Button asChild variant="outline" className="w-full" size="lg" onClick={() => setMobileMenuOpen(false)}>
                        <Link href="/login"><LogIn className="mr-2 h-5 w-5"/>Log In</Link>
                      </Button>
                    </>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
