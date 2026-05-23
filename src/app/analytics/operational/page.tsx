/**
 * /analytics/operational — originations, CC ops, mortgage ops, CX quality.
 */
"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useOperational } from "@/hooks/useAnalytics";
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

function fmtSec(v: number): string {
  if (v < 60) return `${v.toFixed(0)}s`;
  return `${(v / 60).toFixed(1)}min`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function OperationalPage() {
  const sp = useSearchParams();
  const period = (sp.get("period") ?? "ytd") as PeriodToken;
  const product = (sp.get("product") ?? "all") as ProductFilter;

  const { data, isLoading, error } = useOperational(period, product);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load operational data.</p>
      </div>
    );
  }

  const orig = data?.originations;
  const cc = data?.credit_card_ops;
  const mort = data?.mortgage_ops;
  const cx = data?.customer_service;
  const isDemo = data?.data_availability !== "full";

  // ── Top KPI cards
  const topCards: KpiCardProps[] = [
    {
      label: "Total Originations",
      value: orig?.total_count ?? null,
      unit: "count",
      formatStyle: "integer",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Number of accounts originated in the period",
    },
    {
      label: "Originations Volume",
      value: orig?.total_volume_gbp ?? null,
      unit: "GBP",
      formatStyle: "currency",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Total credit extended (GBP)",
    },
    {
      label: "CC Approval Rate",
      value: cc?.approval_rate ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Proportion of CC applications approved",
    },
    {
      label: "Mortgage Approval Rate",
      value: mort?.approval_rate ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "Proportion of mortgage applications approved",
    },
  ];

  // ── Originations trend chart data
  const trendData = (orig?.trend ?? []).map((pt) => ({
    period: pt.period,
    Count: pt.count,
    Volume: pt.volume,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Operational Performance</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Originations, processing and CX · {period.toUpperCase().replace(/_/g, " ")}
          {isDemo && (
            <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
          )}
        </p>
      </div>

      {/* 1. Top KPIs */}
      <KpiCardGrid cards={topCards} cols={4} />

      {/* 2. Originations trend */}
      {trendData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <TrendChart
            data={trendData}
            xKey="period"
            series={[
              {
                dataKey: "Count",
                label: "Originations Count",
                colour: "#1d4ed8",
                yAxisId: "left",
              },
              {
                dataKey: "Volume",
                label: "Volume (GBP)",
                colour: "#059669",
                yAxisId: "right",
                formatter: fmtGbp,
              },
            ]}
            title="Originations Trend"
            leftLabel="Count"
            rightLabel="Volume £"
            height={280}
          />
        </div>
      )}

      {/* 3. CC + Mortgage side-by-side */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* CC ops */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Credit Card Operations</h3>
          <div className="space-y-0">
            <StatRow
              label="Average Credit Limit"
              value={cc?.average_credit_limit != null ? fmtGbp(cc.average_credit_limit) : null}
            />
            <StatRow
              label="Average Utilisation"
              value={cc?.average_utilisation != null ? fmtPct(cc.average_utilisation) : null}
            />
            <StatRow
              label="30-Day Activation Rate"
              value={cc?.activation_rate_30d != null ? fmtPct(cc.activation_rate_30d) : null}
            />
            <StatRow
              label="Average APR"
              value={cc?.average_apr != null ? fmtPct(cc.average_apr) : null}
            />
            <StatRow
              label="STP Rate"
              value={cc?.stp_rate != null ? fmtPct(cc.stp_rate) : null}
            />
            <StatRow
              label="Avg Decision Time"
              value={
                cc?.average_decision_time_seconds != null
                  ? fmtSec(cc.average_decision_time_seconds)
                  : null
              }
            />
          </div>
        </div>

        {/* Mortgage ops */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Mortgage Operations</h3>
          <div className="space-y-0">
            <StatRow
              label="Pipeline Count"
              value={mort?.pipeline_count}
            />
            <StatRow
              label="Pipeline Value"
              value={mort?.pipeline_value_gbp != null ? fmtGbp(mort.pipeline_value_gbp) : null}
            />
            <StatRow
              label="Average LTV"
              value={mort?.average_ltv != null ? fmtPct(mort.average_ltv) : null}
            />
            <StatRow
              label="Average DTI"
              value={mort?.average_dti != null ? fmtPct(mort.average_dti) : null}
            />
            <StatRow
              label="STP Rate"
              value={mort?.stp_rate != null ? fmtPct(mort.stp_rate) : null}
            />
            <StatRow
              label="Avg Time to Offer"
              value={mort?.average_time_to_offer_days != null ? `${mort.average_time_to_offer_days.toFixed(1)} days` : null}
            />
          </div>

          {/* Pipeline by stage */}
          {mort?.pipeline_by_stage && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                Pipeline by Stage
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(mort.pipeline_by_stage).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">
                      {stage.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Customer Service */}
      {cx && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Customer Service & CX Quality</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Complaints / 1k accounts
              </p>
              <p className="text-lg font-semibold">
                {cx.complaint_rate_per_1000?.toFixed(2) ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                PPI Upheld Rate
              </p>
              <p className="text-lg font-semibold">
                {cx.ppi_upheld_rate != null ? fmtPct(cx.ppi_upheld_rate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Resolved &lt;8 Weeks
              </p>
              <p className="text-lg font-semibold">
                {cx.complaints_resolved_within_8_weeks_pct != null
                  ? fmtPct(cx.complaints_resolved_within_8_weeks_pct)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">NPS</p>
              <p
                className={`text-lg font-semibold ${
                  cx.nps_score != null && cx.nps_score >= 0
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {cx.nps_score ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Channel mix */}
      {orig?.by_channel && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Channel Mix</h3>
          <div className="flex gap-6">
            {Object.entries(orig.by_channel).map(([ch, share]) => (
              <div key={ch}>
                <p className="text-[10px] text-muted-foreground uppercase capitalize">{ch}</p>
                <p className="text-lg font-semibold">{fmtPct(share as number)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
