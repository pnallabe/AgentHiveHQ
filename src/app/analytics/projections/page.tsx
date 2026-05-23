/**
 * /analytics/projections — Monte Carlo projection bands (revenue, originations, NPL).
 */
"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useProjections } from "@/hooks/useAnalytics";
import { ProjectionBand } from "@/components/analytics/ProjectionBand";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import type { PeriodToken } from "@/components/analytics/PeriodPicker";
import type { ProductFilter } from "@/components/analytics/ProductToggle";
import type { ProjectionPoint } from "@/components/analytics/ProjectionBand";
import type { HorizonToken, ScenarioToken } from "@/lib/analytics-api";

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

const SCENARIO_COLOURS: Record<string, string> = {
  base: "#1d4ed8",
  stress: "#dc2626",
  upside: "#059669",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}

function PlanBadge({
  label,
  p50,
  plan,
  higher = true,
}: {
  label: string;
  p50: number | null | undefined;
  plan?: number | null;
  higher?: boolean;
}) {
  if (p50 == null) return null;
  const gap =
    plan != null && plan !== 0 ? ((p50 - plan) / Math.abs(plan)) * 100 : null;
  const positive = higher ? (gap ?? 0) >= 0 : (gap ?? 0) <= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-sm font-semibold">{fmtGbp(p50)}</span>
      {gap != null && (
        <span
          className={`text-xs font-medium flex items-center gap-0.5 ${
            positive ? "text-emerald-600" : "text-red-500"
          }`}
        >
          {positive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {gap > 0 ? "+" : ""}
          {gap.toFixed(1)}% vs plan
        </span>
      )}
    </div>
  );
}

export default function ProjectionsPage() {
  const sp = useSearchParams();
  // period is used only for display; projections use a horizon (12m / 24m)
  const period = (sp.get("period") ?? "ytd") as PeriodToken;
  const product = (sp.get("product") ?? "all") as ProductFilter;
  const scenario = (sp.get("scenario") ?? "base") as ScenarioToken;
  const horizon = (sp.get("horizon") ?? "12m") as HorizonToken;

  const { data, isLoading, error } = useProjections(horizon, product, scenario);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load projections data.</p>
      </div>
    );
  }

  const rev = data?.revenue_projection;
  const orig = data?.originations_projection;
  const npl = data?.npl_projection;
  const planComp = data?.plan_comparison;
  const isDemo = data?.data_availability !== "full";
  const accentColour = SCENARIO_COLOURS[data?.scenario ?? "base"] ?? "#1d4ed8";

  // Today label = current year-month
  const today = new Date().toISOString().slice(0, 7);

  // ── Revenue projection data
  const revData: ProjectionPoint[] = (rev?.months ?? []).map((m) => ({
    period: m.period,
    p10: m.net_interest_income_p10,
    p50: m.net_interest_income_p50,
    p90: m.net_interest_income_p90,
  }));

  // ── Originations projection data
  const origData: ProjectionPoint[] = (orig?.months ?? []).map((m) => ({
    period: m.period,
    p10: m.volume_p10,
    p50: m.volume_p50,
    p90: m.volume_p90,
  }));

  // ── NPL projection data
  const nplData: ProjectionPoint[] = (npl?.months ?? []).map((m) => ({
    period: m.period,
    p10: m.npl_rate_p10,
    p50: m.npl_rate_p50,
    p90: m.npl_rate_p90,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Forward Projections</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monte Carlo N=10,000 · Horizon {data?.horizon_months ?? 12}m ·{" "}
            <span className="capitalize font-medium">{data?.scenario ?? "base"}</span> scenario
            {isDemo && (
              <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
            )}
          </p>
        </div>

        {/* Scenario switcher */}
        <div
          role="group"
          aria-label="Scenario"
          className="inline-flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5"
        >
          {["base", "stress", "upside"].map((s) => {
            const active = (data?.scenario ?? "base") === s;
            return (
              <a
                key={s}
                href={`?period=${period}&product=${product}&scenario=${s}`}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors capitalize ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {s}
              </a>
            );
          })}
        </div>
      </div>

      {/* Plan comparison summary */}
      {planComp && (
        <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-wrap gap-6">
          <PlanBadge
            label="Year-end NII (p50)"
            p50={rev?.year_end_total_p50}
            plan={planComp.revenue_plan}
          />
          <PlanBadge
            label="Year-end Originations (p50)"
            p50={orig?.year_end_total_p50}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">NPL within plan:</span>
            <span
              className={`text-sm font-semibold ${
                planComp.npl_p90_within_plan ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {planComp.npl_p90_within_plan == null
                ? "—"
                : planComp.npl_p90_within_plan
                ? "Yes (p90 safe)"
                : "No — p90 breaches ceiling"}
            </span>
          </div>
        </div>
      )}

      {/* Scenario assumptions */}
      {data?.scenario_assumptions && (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-0.5">Scenario assumptions ({data.scenario}):</p>
          <p>{data.scenario_assumptions[data.scenario ?? "base"] ?? "—"}</p>
        </div>
      )}

      {/* Revenue projection band */}
      {revData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <ProjectionBand
            data={revData}
            today={today}
            title="Net Interest Income Projection (p10 / p50 / p90)"
            formatter={fmtGbp}
            accentColour={accentColour}
            height={300}
          />
        </div>
      )}

      {/* Originations projection band */}
      {origData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <ProjectionBand
            data={origData}
            today={today}
            title="Originations Volume Projection (p10 / p50 / p90)"
            formatter={fmtGbp}
            accentColour={accentColour}
            height={280}
          />
        </div>
      )}

      {/* NPL projection band */}
      {nplData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <ProjectionBand
            data={nplData}
            today={today}
            title="NPL Rate Projection (p10 / p50 / p90)"
            formatter={fmtPct}
            accentColour={accentColour}
            height={280}
          />
          {planComp?.npl_plan_ceiling != null && (
            <p className="text-xs text-muted-foreground mt-2">
              Plan ceiling: {fmtPct(planComp.npl_plan_ceiling)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
