"use client";

/**
 * BiasIndicatorChart — Story 4.4 (Bias tab)
 *
 * Fetches GET /api/governance/bias-report and renders:
 *  - FCRA disclaimer alert
 *  - Adverse Impact Ratio card (red if < 0.80, green if >= 0.80)
 *  - Horizontal stacked bar chart showing approval vs rejection per income band
 */

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import type { BiasReport } from "@/lib/types";

// ── Chart data builder ────────────────────────────────────────────────────────

interface BandData {
  band: string;
  approved_pct: number;
  rejected_pct: number;
  total: number;
}

function buildChartData(report: BiasReport): BandData[] {
  const bands = [
    { key: "band_0_under_25k", label: "< $25k" },
    { key: "band_1_25k_50k", label: "$25k–50k" },
    { key: "band_2_50k_100k", label: "$50k–100k" },
    { key: "band_3_over_100k", label: "> $100k" },
  ] as const;

  return bands.map(({ key, label }) => {
    const stats = report.income_band_analysis[key];
    const approved = stats?.total > 0 ? Math.round(stats.rate * 100) : 0;
    return {
      band: label,
      approved_pct: approved,
      rejected_pct: 100 - approved,
      total: stats?.total ?? 0,
    };
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-zinc-200">Income Band: {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="text-xs">
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BiasSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-xl bg-zinc-800/60" />
      <Skeleton className="h-24 w-48 rounded-xl bg-zinc-800/60" />
      <Skeleton className="h-56 w-full rounded-xl bg-zinc-800/60" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BiasIndicatorChart() {
  const [report, setReport] = useState<BiasReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient.governance.biasReport()
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((err) => { if (!cancelled) setError(String((err as Error).message)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <BiasSkeleton />;
  if (error) return (
    <Alert variant="destructive" className="border-red-800/50 bg-red-950/30">
      <AlertDescription className="text-red-400">{error}</AlertDescription>
    </Alert>
  );
  if (!report) return null;

  const chartData = buildChartData(report);
  const ratio = report.adverse_impact_ratio;
  const isFlagged = report.disparate_impact_flag;

  return (
    <div className="space-y-5">
      {/* FCRA Disclaimer */}
      <Alert className="border-zinc-700 bg-zinc-900/60">
        <Info className="h-4 w-4 text-zinc-400" />
        <AlertTitle className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Compliance Disclaimer
        </AlertTitle>
        <AlertDescription className="text-xs text-zinc-500">
          {report.disclaimer}
        </AlertDescription>
      </Alert>

      {/* Adverse Impact Ratio KPI */}
      <Card
        className={`border ${
          isFlagged
            ? "border-red-700/50 bg-red-950/20"
            : "border-emerald-700/50 bg-emerald-950/20"
        }`}
      >
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            {isFlagged ? (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
            Adverse Impact Ratio (Four-Fifths Rule)
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <p
            className={`text-3xl font-bold tabular-nums ${
              isFlagged ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {ratio.toFixed(3)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Threshold: ≥ {report.disparate_impact_threshold.toFixed(2)}.{" "}
            {isFlagged
              ? "⚠ Disparate impact detected — review model inputs."
              : "✓ Within acceptable range."}
          </p>
        </CardContent>
      </Card>

      {/* Approval rate by income band */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Approval Rate by Income Band
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#71717a" }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              dataKey="band"
              type="category"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              width={76}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8, color: "#a1a1aa" }}
            />
            <ReferenceLine x={80} stroke="#f97316" strokeDasharray="4 2" />
            <Bar
              dataKey="approved_pct"
              name="Approved %"
              fill="#10b981"
              radius={[0, 3, 3, 0]}
              stackId="a"
              animationDuration={700}
              animationBegin={0}
            />
            <Bar
              dataKey="rejected_pct"
              name="Rejected %"
              fill="#3f3f46"
              radius={[0, 3, 3, 0]}
              stackId="a"
              animationDuration={700}
              animationBegin={0}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-right text-xs text-zinc-600">
          Orange dashed line = 80% four-fifths threshold
        </p>
      </div>
    </div>
  );
}
