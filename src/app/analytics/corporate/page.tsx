/**
 * /analytics/corporate — people, unit economics, customer base, capital adequacy, NPS.
 */
"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useCorporate } from "@/hooks/useAnalytics";
import { KpiCardGrid } from "@/components/analytics/KpiCardGrid";
import { TrendChart } from "@/components/analytics/TrendChart";
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
  return `${(v * 100).toFixed(1)}%`;
}

function StatGrid({ items }: { items: { label: string; value: string | number | null | undefined }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 mt-3">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold tabular-nums">{value ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

export default function CorporatePage() {
  const sp = useSearchParams();
  const period = (sp.get("period") ?? "ytd") as PeriodToken;
  const product = (sp.get("product") ?? "all") as ProductFilter;

  const { data, isLoading, error } = useCorporate(period);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load corporate data.</p>
      </div>
    );
  }

  const people = data?.people_metrics;
  const ue = data?.unit_economics;
  const cb = data?.customer_base;
  const cap = data?.regulatory_capital;
  const nps = data?.nps_and_quality;
  const isDemo = data?.data_availability !== "full";

  // ── Capital adequacy KPI cards (with alerts)
  const capCards: KpiCardProps[] = [
    {
      label: "CET1 Ratio",
      value: cap?.cet1_ratio ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs regulatory min",
      alertThreshold: cap?.regulatory_minimum_cet1 ?? 0.08,
      alertDirection: "below",
      tooltip: "Common Equity Tier 1 ratio — regulatory minimum ~8%",
    },
    {
      label: "Total Capital Ratio",
      value: cap?.total_capital_ratio ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Total capital / risk-weighted assets",
    },
    {
      label: "Leverage Ratio",
      value: cap?.leverage_ratio ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Tier 1 capital / total exposures",
    },
    {
      label: "LCR",
      value: cap?.lcr ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs min",
      alertThreshold: 1.0,
      alertDirection: "below",
      tooltip: "Liquidity Coverage Ratio — minimum 100%",
    },
  ];

  // ── Headcount trend
  const headcountTrend = (people?.headcount_trend ?? []).map((pt) => ({
    period: pt.period,
    Headcount: pt.headcount,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Corporate Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          People, economics, capital & NPS · {period.toUpperCase().replace(/_/g, " ")}
          {isDemo && (
            <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
          )}
        </p>
      </div>

      {/* 1. Regulatory capital KPIs */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Regulatory Capital
        </h3>
        <KpiCardGrid cards={capCards} cols={4} />
        {cap?.buffer_above_minimum_bps != null && (
          <p className="text-xs text-muted-foreground mt-2">
            CET1 buffer above minimum:{" "}
            <span className="font-medium text-emerald-600">
              {cap.buffer_above_minimum_bps} bps
            </span>
          </p>
        )}
      </div>

      {/* 2. People metrics */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold mb-1">People & Workforce</h3>
        <StatGrid
          items={[
            { label: "Total Headcount", value: people?.total_headcount },
            {
              label: "Attrition Rate",
              value:
                people?.attrition_rate_annualised != null
                  ? fmtPct(people.attrition_rate_annualised)
                  : null,
            },
            {
              label: "Revenue / FTE",
              value:
                people?.revenue_per_fte != null ? fmtGbp(people.revenue_per_fte) : null,
            },
          ]}
        />
        {/* Headcount by function */}
        {people?.headcount_by_function && (
          <div className="mt-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              By Function
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              {Object.entries(people.headcount_by_function).map(([fn, count]) => (
                <div key={fn} className="flex justify-between text-xs border-b border-border/40 pb-0.5">
                  <span className="text-muted-foreground capitalize">
                    {fn.replace(/_/g, " ")}
                  </span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Headcount trend */}
        {headcountTrend.length > 0 && (
          <div className="mt-4">
            <TrendChart
              data={headcountTrend}
              xKey="period"
              series={[{ dataKey: "Headcount", label: "Total Headcount", colour: "#1d4ed8" }]}
              height={200}
              title="Headcount Trend"
            />
          </div>
        )}
      </div>

      {/* 3. Unit economics */}
      {ue && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Unit Economics</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                label: "Customer Acquisition Cost",
                cc: ue.customer_acquisition_cost.credit_card,
                mort: ue.customer_acquisition_cost.mortgage,
                fmt: fmtGbp,
              },
              {
                label: "Estimated CLV",
                cc: ue.customer_lifetime_value_estimated.credit_card,
                mort: ue.customer_lifetime_value_estimated.mortgage,
                fmt: fmtGbp,
              },
              {
                label: "LTV:CAC Ratio",
                cc: ue.ltv_cac_ratio.credit_card,
                mort: ue.ltv_cac_ratio.mortgage,
                fmt: (v: number) => `${v.toFixed(1)}×`,
              },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {row.label}
                </p>
                <p className="text-xs">
                  CC: <span className="font-medium">{row.cc != null ? row.fmt(row.cc) : "—"}</span>
                </p>
                <p className="text-xs">
                  Mortgages:{" "}
                  <span className="font-medium">
                    {row.mort != null ? row.fmt(row.mort) : "—"}
                  </span>
                </p>
                {ue.ltv_cac_ratio.blended != null && row.label === "LTV:CAC Ratio" && (
                  <p className="text-xs text-muted-foreground">
                    Blended: <span className="font-medium">{ue.ltv_cac_ratio.blended.toFixed(1)}×</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Customer base */}
      {cb && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-1">Customer Base</h3>
          <StatGrid
            items={[
              { label: "Active Customers", value: cb.total_active_customers?.toLocaleString() },
              { label: "New Customers", value: cb.new_customers_period?.toLocaleString() },
              {
                label: "Multi-product",
                value: cb.multi_product_customers != null ? fmtPct(cb.multi_product_customers) : null,
              },
              {
                label: "Avg Tenure",
                value:
                  cb.customer_tenure_avg_months != null
                    ? `${cb.customer_tenure_avg_months.toFixed(0)} months`
                    : null,
              },
              {
                label: "Churn Rate",
                value:
                  cb.churn_rate_annualised != null ? fmtPct(cb.churn_rate_annualised) : null,
              },
            ]}
          />
        </div>
      )}

      {/* 5. NPS and quality */}
      {nps && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">NPS & Quality</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Overall NPS", value: nps.nps_overall },
              { label: "CC NPS", value: nps.nps_credit_card },
              { label: "Mortgage NPS", value: nps.nps_mortgage },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p
                  className={`text-xl font-bold ${
                    value != null && value >= 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {value ?? "—"}
                </p>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Complaints / 1k
              </p>
              <p className="text-sm font-semibold">{nps.fca_complaint_rate_per_1000?.toFixed(2) ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Upheld %
              </p>
              <p className="text-sm font-semibold">
                {nps.complaints_upheld_pct != null ? fmtPct(nps.complaints_upheld_pct) : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
