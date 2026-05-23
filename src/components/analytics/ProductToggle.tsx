/**
 * ProductToggle — selects the product filter (All / Credit Cards / Mortgages).
 * Reads/writes the `product` URL search param via Next.js router.
 */
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ProductFilter = "all" | "credit_card" | "mortgage";

const PRODUCT_OPTIONS: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "All Products" },
  { value: "credit_card", label: "Credit Cards" },
  { value: "mortgage", label: "Mortgages" },
];

export interface ProductToggleProps {
  /** Controlled value — if provided, caller owns state */
  value?: ProductFilter;
  /** Called on selection; caller can choose to update URL independently */
  onChange?: (p: ProductFilter) => void;
  className?: string;
}

export function ProductToggle({ value, onChange, className }: ProductToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = (value ?? searchParams.get("product") ?? "all") as ProductFilter;

  function handleSelect(p: ProductFilter) {
    onChange?.(p);
    const params = new URLSearchParams(searchParams.toString());
    params.set("product", p);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Product filter"
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5",
        className
      )}
    >
      {PRODUCT_OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            aria-pressed={active}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap",
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
