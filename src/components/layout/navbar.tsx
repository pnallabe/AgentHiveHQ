"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, RocketIcon } from "lucide-react";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import * as React from "react";


const navLinks = [
  { href: "/#home", label: "Home" },
  { href: "/#about", label: "About" },
  { href: "/#products", label: "Products" },
  { href: "/#rulesense-highlight", label: "RuleSense" },
  { href: "/#contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const renderNavLinks = (isMobile: boolean = false) => (
    navLinks.map((link) => (
      <Button
        key={link.label}
        variant="link"
        asChild
        className={cn(
          "text-sm font-medium",
          isMobile ? "text-foreground hover:text-primary w-full justify-start py-2" : "text-muted-foreground hover:text-foreground",
          (pathname === link.href || (pathname === '/' && link.href === '/#home')) && (isMobile ? "text-primary font-semibold" : "text-foreground font-semibold")
        )}
      >
        <Link href={link.href}>{link.label}</Link>
      </Button>
    ))
  );

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isScrolled ? "border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-md" : "bg-transparent"
    )}>
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/#home" className="flex items-center gap-2">
          <RocketIcon className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">AgentHiveHQ</span>
        </Link>
        <nav className="hidden items-center space-x-2 md:flex">
          {renderNavLinks()}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild className="hidden md:inline-flex">
            <Link href="/#contact">Get Started</Link>
          </Button>
          <ThemeToggleButton />
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-6">
                <div className="mb-6 flex items-center gap-2">
                    <RocketIcon className="h-7 w-7 text-primary" />
                    <span className="text-xl font-bold text-foreground">AgentHiveHQ</span>
                </div>
                <nav className="flex flex-col space-y-2">
                  {renderNavLinks(true)}
                </nav>
                <Button asChild className="mt-6 w-full">
                  <Link href="/#contact">Get Started</Link>
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
