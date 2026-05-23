/**
 * /analytics/risk — portfolio quality, DPD, vintage curves, concentration, stress.
 */
"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useRisk } from "@/hooks/useAnalytics";
import { KpiCardGrid } from "@/components/analytics/KpiCardGrid";
import { VintageCurveChart } from "@/components/analytics/VintageCurveChart";
import { HeatmapTable } from "@/components/analytics/HeatmapTable";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { PeriodToken } from "@/components/analytics/PeriodPicker";
import type { ProductFilter } from "@/components/analytics/ProductToggle";
import type { KpiCardProps } from "@/components/analytics/KpiCard";
import type { VintageCurve as VintageCurveData } from "@/components/analytics/VintageCurveChart";

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
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function RiskPage() {
  const sp = useSearchParams();
  const period = (sp.get("period") ?? "ytd") as PeriodToken;
  const product = (sp.get("product") ?? "all") as ProductFilter;

  const { data, isLoading, error } = useRisk(period, product);

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm text-muted-foreground">Failed to load risk data.</p>
      </div>
    );
  }

  const pq = data?.portfolio_quality;
  const dpd = data?.dpd_distribution;
  const conc = data?.concentration_risk;
  const stress = data?.stress_indicators;
  const isDemo = data?.data_availability !== "full";

  // ── KPI cards
  const cards: KpiCardProps[] = [
    {
      label: "NPL Rate",
      value: pq?.npl_rate ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      alertThreshold: 0.025,
      alertDirection: "above",
      tooltip: "Non-performing loans as a fraction of total outstanding",
    },
    {
      label: "ECL Provision",
      value: pq?.ecl_provision_gbp ?? null,
      unit: "GBP",
      formatStyle: "currency",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "IFRS 9 expected credit loss provision",
    },
    {
      label: "Coverage Ratio",
      value: pq?.provision_coverage_ratio ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      tooltip: "ECL provision / NPL balance",
    },
    {
      label: "Net Charge-Off",
      value: pq?.net_charge_off_rate_annualised ?? null,
      unit: "%",
      formatStyle: "percent",
      delta: null,
      deltaLabel: "vs prev",
      alertThreshold: 0.02,
      alertDirection: "above",
      tooltip: "Annualised net charge-off rate",
    },
  ];

  // ── Vintage curves — transform API shape → component shape
  const vintageCurves: VintageCurveData[] = (data?.vintage_curves ?? []).map((vc) => ({
    cohort: vc.cohort,
    points: (vc.data_points ?? []).map((dp) => ({
      month: dp.months_on_book,
      rate: dp.cumulative_default_rate,
    })),
  }));

  // ── DPD heatmap table
  const dpdRows = dpd
    ? [
        {
          label: "DPD Distribution",
          cells: [
            { value: dpd.current ?? null, formatted: dpd.current != null ? fmtPct(dpd.current) : "—" },
            { value: dpd.dpd_1_29 ?? null, formatted: dpd.dpd_1_29 != null ? fmtPct(dpd.dpd_1_29) : "—" },
            { value: dpd.dpd_30_59 ?? null, formatted: dpd.dpd_30_59 != null ? fmtPct(dpd.dpd_30_59) : "—" },
            { value: dpd.dpd_60_89 ?? null, formatted: dpd.dpd_60_89 != null ? fmtPct(dpd.dpd_60_89) : "—" },
            { value: dpd.dpd_90_plus ?? null, formatted: dpd.dpd_90_plus != null ? fmtPct(dpd.dpd_90_plus) : "—" },
          ],
        },
      ]
    : [];

  // ── LTV band heatmap
  const ltvBands = conc?.ltv_bands_mortgage
    ? Object.entries(conc.ltv_bands_mortgage).map(([band, share]) => ({
        label: band.replace(/_/g, "–"),
        cells: [
          {
            value: share as number | null,
            formatted: share != null ? fmtPct(share as number) : "—",
            plan: band === "over_85" ? 0.05 : undefined, // flag if >85 LTV > 5%
          },
        ],
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Risk Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Asset quality, DPD, vintage curves & stress · {period.toUpperCase().replace(/_/g, " ")}
          {isDemo && (
            <span className="ml-2 text-amber-600 font-medium text-xs">(Sample Data)</span>
          )}
        </p>
      </div>

      {/* 1. KPI cards */}
      <KpiCardGrid cards={cards} cols={4} />

      {/* 2. DPD distribution */}
      {dpdRows.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <HeatmapTable
            rows={dpdRows}
            columns={["Current", "1–29 DPD", "30–59 DPD", "60–89 DPD", "90+ DPD"]}
            title="DPD Bucket Distribution"
            thresholds={{ neutral: 0.02, higherIsBetter: false }}
          />
        </div>
      )}

      {/* 3. Vintage curves */}
      {vintageCurves.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <VintageCurveChart curves={vintageCurves} title="Vintage Default Curves" height={320} />
        </div>
      )}

      {/* 4. Product quality breakdown */}
      {pq?.by_product && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Asset Quality by Product</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            {Object.entries(pq.by_product).map(([prod, q]) => (
              <div key={prod}>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                  {prod === "credit_card" ? "Credit Cards" : "Mortgages"}
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "Outstanding", value: q.outstanding != null ? fmtGbp(q.outstanding) : "—" },
                    { label: "NPL Rate", value: q.npl_rate != null ? fmtPct(q.npl_rate) : "—" },
                    { label: "ECL Provision", value: q.ecl != null ? fmtGbp(q.ecl) : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs border-b border-border/40 pb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. LTV concentration */}
      {ltvBands.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <HeatmapTable
            rows={ltvBands}
            columns={["Share"]}
            title="Mortgage LTV Band Concentration"
            thresholds={{ neutral: 0.05, higherIsBetter: false }}
          />
        </div>
      )}

      {/* 6. Geographic concentration */}
      {conc?.geography && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Geographic Concentration</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(conc.geography).map(([region, share]) => (
              <div key={region}>
                <p className="text-[10px] text-muted-foreground uppercase">{region}</p>
                <p className="text-sm font-semibold">{fmtPct(share as number)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Stress indicators */}
      {stress && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3">
            Stress Test Indicators
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                label: "+100bps Rate Shock — NII Impact",
                value:
                  stress.rate_sensitivity_100bps_nii_impact_gbp != null
                    ? fmtGbp(stress.rate_sensitivity_100bps_nii_impact_gbp)
                    : "—",
              },
              {
                label: "+1pp Unemployment — NPL Impact",
                value:
                  stress.unemployment_1ppt_npl_impact_bps != null
                    ? `${stress.unemployment_1ppt_npl_impact_bps.toFixed(0)} bps`
                    : "—",
              },
              {
                label: "−10% HPI — LTV Breach Count",
                value:
                  stress.house_price_10pct_decline_ltv_breach_count != null
                    ? stress.house_price_10pct_decline_ltv_breach_count.toLocaleString()
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="text-base font-semibold text-red-700 dark:text-red-400 mt-0.5">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
