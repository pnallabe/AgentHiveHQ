import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

const FOOTER_NAV = [
  {
    heading: "Platform",
    links: [
      { label: "Products",      href: "/#products"       },
      { label: "How It Works",  href: "/#how-it-works"   },
      { label: "Case Studies",  href: "/case-studies"    },
      { label: "Product Lab",   href: "/lab"             },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy",    href: "/privacy-policy"   },
      { label: "Terms of Service",  href: "/terms-of-service" },
    ],
  },
  {
    heading: "Compliance",
    links: [
      { label: "FCRA §615",       href: "#" },
      { label: "SR 11-7",         href: "#" },
      { label: "SHAP Audit Logs", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface-base">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        {/* Top row */}
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Logo size={26} showWordmark />
            <p className="max-w-[200px] text-xs leading-relaxed text-zinc-500">
              Production-grade AI credit decisioning for regulated lenders.
            </p>
            <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest">
              Built for compliance. Designed for scale.
            </p>
          </div>

          {/* Nav columns */}
          {FOOTER_NAV.map((col) => (
            <div key={col.heading}>
              <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-zinc-500 transition-colors hover:text-zinc-200"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-surface-border pt-6 sm:flex-row">
          <p className="font-mono text-xs text-zinc-700">
            © {new Date().getFullYear()} Helix Decisions, Inc. All rights reserved.
          </p>
          <p className="font-mono text-[10px] text-zinc-700 uppercase tracking-widest">
            FCRA · SR 11-7 · SOC 2 Ready
          </p>
        </div>
      </div>
    </footer>
  );
}
