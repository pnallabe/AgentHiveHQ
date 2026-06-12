import { cn } from "@/lib/utils";
import Link from "next/link";

interface LogoProps {
  href?: string;
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Helix Decisions double-helix SVG logomark + wordmark.
 * Two S-curve strands in brand-500 crossing twice, with three rungs.
 */
export function Logo({
  href = "/",
  size = 28,
  showWordmark = true,
  className,
}: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Strand 1 — front, full opacity */}
      <path
        d="M 8,4 C 8,9 20,9 20,14 C 20,19 8,19 8,24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        className="text-brand-500"
      />
      {/* Strand 2 — back, reduced opacity to show depth */}
      <path
        d="M 20,4 C 20,9 8,9 8,14 C 8,19 20,19 20,24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
        fill="none"
        className="text-brand-500"
      />
      {/* Rung — above first crossing (y=9) */}
      <line x1="10" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.65" className="text-brand-500" />
      {/* Rung — center, between the two crossings */}
      <line x1="8" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.65" className="text-brand-500" />
      {/* Rung — below second crossing (y=19) */}
      <line x1="10" y1="21" x2="18" y2="21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.65" className="text-brand-500" />
    </svg>
  );

  const inner = (
    <span className={cn("flex items-center gap-2", className)}>
      {mark}
      {showWordmark && (
        <span className="font-heading font-semibold text-lg leading-none tracking-tight text-foreground">
          Helix Decisions
        </span>
      )}
    </span>
  );

  return href ? (
    <Link href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-sm">
      {inner}
    </Link>
  ) : (
    inner
  );
}
