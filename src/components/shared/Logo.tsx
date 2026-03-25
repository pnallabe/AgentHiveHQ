import { cn } from "@/lib/utils";
import Link from "next/link";

interface LogoProps {
  href?: string;
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * AgentHive hexagonal SVG logomark + wordmark.
 * Hexagon fill uses brand-500 electric blue.
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
      {/* Hexagon path — flat-top orientation */}
      <path
        d="M14 2L24.7 8V20L14 26L3.3 20V8L14 2Z"
        fill="currentColor"
        className="text-brand-500"
      />
      {/* Inner hive cell detail */}
      <path
        d="M14 8L19.2 11V17L14 20L8.8 17V11L14 8Z"
        fill="none"
        stroke="white"
        strokeWidth="1.2"
        strokeOpacity="0.9"
      />
      <circle cx="14" cy="14" r="1.5" fill="white" fillOpacity="0.9" />
    </svg>
  );

  const inner = (
    <span className={cn("flex items-center gap-2", className)}>
      {mark}
      {showWordmark && (
        <span className="font-heading font-semibold text-lg leading-none tracking-tight text-foreground">
          AgentHive
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
