/**
 * PeriodPicker — selects the analytics period token.
 * Reads/writes the `period` URL search param via Next.js router.
 */
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type PeriodToken =
  | "mtd"
  | "qtd"
  | "ytd"
  | "last_30"
  | "last_90"
  | "last_12m"
  | "custom";

const PERIOD_OPTIONS: { value: PeriodToken; label: string }[] = [
  { value: "mtd", label: "MTD" },
  { value: "qtd", label: "QTD" },
  { value: "ytd", label: "YTD" },
  { value: "last_30", label: "30D" },
  { value: "last_90", label: "90D" },
  { value: "last_12m", label: "12M" },
];

export interface PeriodPickerProps {
  /** Controlled value — if provided, caller owns state */
  value?: PeriodToken;
  /** Called on selection; caller can choose to update URL independently */
  onChange?: (p: PeriodToken) => void;
  className?: string;
}

export function PeriodPicker({ value, onChange, className }: PeriodPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (value ?? searchParams.get("period") ?? "ytd") as PeriodToken;

  function handleSelect(p: PeriodToken) {
    onChange?.(p);
    // Always reflect in URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Period selector"
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5",
        className
      )}
    >
      {PERIOD_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            aria-pressed={active}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
