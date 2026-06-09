/**
 * /analytics/overview — high-level executive scorecard.
 *
 * Sections:
 *   1. KPI card grid (6 headline KPIs)
 *   2. Plan vs Actual attainment
 *   3. Product revenue split
 *   4. Active risk flags
 *   5. AI Executive Brief (collapsible)
 */
"use client";
// This page reads URL search params — disable static prerendering so
// Next.js does not attempt to generate a static shell without param context.
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOverview } from "@/hooks/useAnalytics";
import { KpiCardGrid } from "@/components/analytics/KpiCardGrid";
import { BarComparisonChart } from "@/components/analytics/BarComparisonChart";
import { AiBriefCard, type ExecutiveBrief } from "@/components/analytics/AiBriefCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle } from "lucide-react";
import { generateExecutiveBrief } from "@/ai/actions";
import type { PeriodToken } from "@/components/analytics/PeriodPicker";
import type { ProductFilter } from "@/components/analytics/ProductToggle";
import type { KpiCardProps, FormatStyle } from "@/components/analytics/KpiCard";
import type { KpiValue, HeadlineKpis } from "@/lib/analytics-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unitToFormatStyle(unit: string | null | undefined): FormatStyle {
  if (!unit) return "integer";
  if (unit === "GBP" || unit === "£") return "currency";
  if (unit === "%") return "percent";
  if (unit === "bps") return "bps";
  if (unit === "days") return "days";
  return "integer";
}

function kpiToCard(
  label: string,
  kpi: KpiValue | undefined,
  overrides?: Partial<KpiCardProps>
): KpiCardProps {
  const unit = (kpi?.unit ?? "count") as KpiCardProps["unit"];
  const formatStyle = unitToFormatStyle(kpi?.unit);
  return {
    label,
    value: kpi?.value ?? null,
    unit,
    formatStyle,
    delta: kpi?.delta_pct ?? null,
    deltaLabel: kpi?.vs ?? "vs prev",
    ...overrides,
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

function fmt(v: number | null | undefined, pct = false): string {
  if (v == null) return "—";
  if (pct) return `${(v * 100).toFixed(1)}%`;
  if (Math.abs(v) >= 1e9) return `£${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `£${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `£${(v / 1e3).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OverviewPage() {
  const searchParams = useSearchParams();
  const period = (searchParams.get("period") ?? "ytd") as PeriodToken;
  const product = (searchParams.get("product") ?? "all") as ProductFilter;

  const { data, isLoading, error } = useOverview(period, product);
  const [brief, setBrief] = useState<ExecutiveBrief | undefined>(undefined);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | undefined>(undefined);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load overview data.</p>
        <p className="text-xs text-muted-foreground">{String(error)}</p>
      </div>
    );
  }

  const headline = data?.headline_kpis as HeadlineKpis | undefined;
  const isDemo = data?.data_availability !== "full";

  // ── KPI cards from HeadlineKpis struct
  const cards: KpiCardProps[] = [
    kpiToCard("Total Revenue", headline?.total_revenue),
    kpiToCard("Net Interest Income", headline?.net_interest_income),
    kpiToCard("Total Originations", headline?.total_originations_volume),
    kpiToCard("NPL Rate", headline?.npl_rate),
    kpiToCard("Approval Rate", headline?.approval_rate),
    kpiToCard("Return on Equity", headline?.roe),
  ];

  // ── Plan vs actual bar chart
  const pva = data?.plan_vs_actual;
  const planVsActualData = pva
    ? [
        {
          metric: "Revenue",
          Actual: pva.revenue_attainment ?? 0,
          Plan: 1.0,
        },
        {
          metric: "Originations",
          Actual: pva.originations_attainment ?? 0,
          Plan: 1.0,
        },
      ]
    : [];

  // ── Product split
  const splitData = Object.entries(data?.product_split ?? {}).map(([key, val]) => ({
    product: key === "credit_card" ? "Credit Cards" : "Mortgages",
    Revenue: val.revenue_share ?? 0,
    Originations: val.originations_share ?? 0,
  }));

  // ── Top risks
  const risks = data?.top_risks ?? [];

  // ── Brief generation handler
  async function handleGenerateBrief() {
    if (!data) return;
    setBriefLoading(true);
    setBriefError(undefined);
    try {
      const result = await generateExecutiveBrief({
        kpi_snapshot: {
          net_interest_income: headline?.net_interest_income?.value,
          net_interest_margin: undefined,
          originations_volume: headline?.total_originations_volume?.value,
          npl_rate: headline?.npl_rate?.value,
          revenue_attainment: data.plan_vs_actual?.revenue_attainment,
          npl_plan_ceiling: undefined,
          year_end_nii_p50: undefined,
          top_risk_descriptions: risks.map((r) => r.description),
          period_label: period.toUpperCase().replace(/_/g, " "),
          product_label:
            product === "all"
              ? "All Products"
              : product === "credit_card"
              ? "Credit Cards"
              : "Mortgages",
          data_availability: data.data_availability,
        },
        tone: "board_brief",
        data_as_of: data.data_as_of,
      });
      setBrief({
        headline: result.headline,
        summary: result.summary,
        highlights: result.highlights,
        risks: result.risks,
        generated_at: result.generated_at,
      });
    } catch (err) {
      setBriefError(String(err));
    } finally {
      setBriefLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Portfolio Overview</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Headline KPIs · {period.toUpperCase().replace(/_/g, " ")}
          {isDemo && (
            <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
          )}
        </p>
      </div>

      {/* 1. KPI cards */}
      <KpiCardGrid cards={cards} cols={6} />

      {/* 2. Plan vs Actual */}
      {planVsActualData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <BarComparisonChart
            data={planVsActualData}
            xKey="metric"
            bars={[
              { dataKey: "Actual", label: "Actual attainment", colour: "#1d4ed8" },
              { dataKey: "Plan", label: "Plan (1.0×)", colour: "#94a3b8" },
            ]}
            title="Plan Attainment"
            height={220}
            yLabel="Ratio"
          />
          {pva?.cost_income_ratio && (
            <p className="text-xs text-muted-foreground mt-2">
              Cost-income ratio: Actual{" "}
              <span className="font-medium">
                {fmt(pva.cost_income_ratio.actual as number, true)}
              </span>{" "}
              vs Plan{" "}
              <span className="font-medium">
                {fmt(pva.cost_income_ratio.plan as number, true)}
              </span>{" "}
              — {pva.cost_income_ratio.status as string}
            </p>
          )}
        </div>
      )}

      {/* 3. Product split */}
      {splitData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <BarComparisonChart
            data={splitData}
            xKey="product"
            bars={[
              { dataKey: "Revenue", label: "Revenue share", colour: "#1d4ed8" },
              { dataKey: "Originations", label: "Originations share", colour: "#059669" },
            ]}
            title="Product Revenue & Originations Split"
            height={200}
          />
        </div>
      )}

      {/* 4. Active risk flags */}
      {risks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Active Risk Flags
            </h3>
          </div>
          <ul className="space-y-1.5">
            {risks.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-xs">
                <span
                  className={
                    r.severity === "high"
                      ? "text-red-500"
                      : r.severity === "medium"
                      ? "text-amber-500"
                      : "text-yellow-400"
                  }
                >
                  ▸
                </span>
                <span>
                  <span className="font-medium">{r.code}</span> — {r.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. AI Executive Brief */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            AI-generated · Gemini 2.0 Flash · Not a substitute for professional advice
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateBrief}
            disabled={briefLoading || isLoading}
            className="gap-1.5 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            {brief ? "Regenerate Brief" : "Generate Brief"}
          </Button>
        </div>
        {briefError && (
          <p className="text-xs text-red-500">Failed to generate brief: {briefError}</p>
        )}
        <AiBriefCard brief={brief} isLoading={briefLoading} isDemo={isDemo} />
      </div>
    </div>
  );
}
