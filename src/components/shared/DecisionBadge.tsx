import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Decision } from "@/lib/types";

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1",
  {
    variants: {
      variant: {
        success:
          "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
        destructive:
          "bg-red-500/10 text-red-400 ring-red-500/30",
        warning:
          "bg-amber-500/10 text-amber-400 ring-amber-500/30",
      },
    },
    defaultVariants: {
      variant: "success",
    },
  }
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DecisionBadgeProps extends VariantProps<typeof badgeVariants> {
  decision?: Decision;
  className?: string;
  showIcon?: boolean;
}

const DECISION_CONFIG: Record<
  Decision,
  { label: string; variant: NonNullable<DecisionBadgeProps["variant"]>; Icon: React.ElementType }
> = {
  approve: { label: "Approved", variant: "success", Icon: CheckCircle2 },
  reject: { label: "Rejected", variant: "destructive", Icon: XCircle },
  review: { label: "Under Review", variant: "warning", Icon: Clock },
};

export function DecisionBadge({
  decision,
  variant,
  className,
  showIcon = true,
}: DecisionBadgeProps) {
  const config = decision ? DECISION_CONFIG[decision] : null;
  const resolvedVariant = variant ?? config?.variant ?? "success";
  const Icon = config?.Icon;
  const label = config?.label ?? "Unknown";

  return (
    <span className={cn(badgeVariants({ variant: resolvedVariant }), className)}>
      {showIcon && Icon && <Icon className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}
