/**
 * AnalyticsLayoutClient — client component that reads URL params and
 * provides AnalyticsShell with the current period + product selection.
 */
"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AnalyticsShell } from "@/components/analytics/AnalyticsShell";
import { useOverview } from "@/hooks/useAnalytics";
import type { PeriodToken } from "@/components/analytics/PeriodPicker";
import type { ProductFilter } from "@/components/analytics/ProductToggle";

export function AnalyticsLayoutClient({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const period = (searchParams.get("period") ?? "ytd") as PeriodToken;
  const product = (searchParams.get("product") ?? "all") as ProductFilter;

  // Pull data_as_of from the overview endpoint for the freshness tag
  const { data: overview } = useOverview(period, product);

  return (
    <AnalyticsShell
      period={period}
      product={product}
      dataAsOf={overview?.data_as_of}
    >
      {children}
    </AnalyticsShell>
  );
}
