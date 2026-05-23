/**
 * /analytics/financial — P&L, margins, revenue trend, waterfall.
 */
"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useFinancial } from "@/hooks/useAnalytics";
import { KpiCardGrid } from "@/components/analytics/KpiCardGrid";
import { TrendChart } from "@/components/analytics/TrendChart";
import { WaterfallChart } from "@/components/analytics/WaterfallChart";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { PeriodToken } from "@/components/analytics/PeriodPicker";
import type { ProductFilter } from "@/components/analytics/ProductToggle";
import type { KpiCardProps } from "@/components/analytics/KpiCard";

function fmtGbp(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `£${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `£${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `£${(v / 1e3).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export default function FinancialPage() {
  const sp = useSearchParams();
  const period = (sp.get("period") ?? "ytd") as PeriodToken;
  const product = (sp.get("product") ?? "all") as ProductFilter;

  const { data, isLoading, error } = useFinancial(period, product);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load financial data.</p>
      </div>
    );
  }

  const inc = data?.income_statement;
  const mar = data?.margins;
  const isDemo = data?.data_availability !== "full";

  // ── Margin KPI cards
  const marginCards: KpiCardProps[] = [
    {
      label: "Net Interest Margin",
      value: mar?.net_interest_margin ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "NII / average interest-earning assets (annualised)",
    },
    {
      label: "Cost-Income Ratio",
      value: mar?.cost_income_ratio ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Operating costs / total income",
    },
    {
      label: "Return on Equity",
      value: mar?.return_on_equity ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Annualised net income / average equity",
    },
    {
      label: "Return on Assets",
      value: mar?.return_on_assets ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Annualised net income / average total assets",
    },
  ];

  // ── Revenue trend chart
  const trendData = (data?.revenue_trend ?? []).map((pt) => ({
    period: pt.period,
    "Interest Income": pt.interest_income,
    "Fee Income": pt.fee_income,
    "Cost of Funds": pt.cost_of_funds ? -pt.cost_of_funds : null,
  }));

  // ── Waterfall items
  const waterfallItems = (data?.waterfall?.items ?? []).map((item) => ({
    label: item.label,
    value: item.value,
    type: item.type as "positive" | "negative" | "subtotal" | "total",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Financial Performance</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          P&amp;L, margins and revenue trends · {period.toUpperCase().replace(/_/g, " ")}
          {isDemo && (
            <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
          )}
        </p>
      </div>

      {/* 1. Margin KPIs */}
      <KpiCardGrid cards={marginCards} cols={4} />

      {/* 2. Income statement summary */}
      {inc && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Income Statement Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            {[
              { label: "Interest Income", value: inc.interest_income },
              { label: "Fee Income", value: inc.fee_income },
              { label: "Total Revenue", value: inc.total_revenue, highlight: true },
              { label: "Cost of Funds", value: inc.cost_of_funds, negative: true },
              { label: "Net Interest Income", value: inc.net_interest_income, highlight: true },
              { label: "Operating Costs", value: inc.operating_costs, negative: true },
              { label: "ECL Charge", value: inc.ecl_charge, negative: true },
              { label: "Profit Before Tax", value: inc.profit_before_tax, highlight: true },
            ].map(({ label, value, highlight, negative }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {label}
                </p>
                <p
                  className={
                    highlight
                      ? "text-sm font-semibold"
                      : negative
                      ? "text-sm text-red-500"
                      : "text-sm"
                  }
                >
                  {value != null ? fmtGbp(value) : "—"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Revenue trend */}
      {trendData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <TrendChart
            data={trendData}
            xKey="period"
            series={[
              { dataKey: "Interest Income", label: "Interest Income", colour: "#1d4ed8", formatter: fmtGbp },
              { dataKey: "Fee Income", label: "Fee Income", colour: "#059669", formatter: fmtGbp },
              { dataKey: "Cost of Funds", label: "Cost of Funds (neg.)", colour: "#dc2626", formatter: fmtGbp },
            ]}
            title="Revenue Trend"
            height={280}
          />
        </div>
      )}

      {/* 4. P&L waterfall */}
      {waterfallItems.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <WaterfallChart items={waterfallItems} title="P&L Waterfall" height={320} />
        </div>
      )}

      {/* NIM by product */}
      {mar?.nim_by_product && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">NIM by Product</h3>
          <div className="flex gap-6">
            {Object.entries(mar.nim_by_product).map(([prod, nim]) => (
              <div key={prod}>
                <p className="text-[10px] text-muted-foreground uppercase">
                  {prod === "credit_card" ? "Credit Cards" : "Mortgages"}
                </p>
                <p className="text-lg font-semibold">{nim != null ? fmtPct(nim) : "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
