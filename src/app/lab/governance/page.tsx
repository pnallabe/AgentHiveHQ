"use client";

/**
 * Governance Dashboard — Story 4.4
 *
 * Three-tab layout:
 *   Overview          — KPI cards, period selector, segment approval chart, feature importance
 *   Decision History  — Paginated audit table (DecisionHistoryTable)
 *   Bias Report       — Four-fifths rule, adverse impact ratio, income-band chart
 */

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Percent,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DecisionHistoryTable } from "@/components/governance/DecisionHistoryTable";
import { BiasIndicatorChart } from "@/components/governance/BiasIndicatorChart";
import { FeatureImportanceChart } from "@/components/governance/FeatureImportanceChart";
import { apiClient } from "@/lib/api";
import type { GovernanceDashboard } from "@/lib/types";

// ── Period options ────────────────────────────────────────────────────────────

type Period = "last_7_days" | "last_30_days" | "last_90_days" | "all_time";

const PERIOD_LABELS: Record<Period, string> = {
  last_7_days:  "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  all_time:     "All time",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:     string;
  value:     string;
  icon:      React.ReactNode;
  sub?:      string;
  loading:   boolean;
  sparkData?: { v: number }[];
  sparkColor?: string;
}

function KpiCard({ label, value, icon, sub, loading, sparkData, sparkColor = "#3366f4" }: KpiCardProps) {
  return (
    <Card className="border-surface-border bg-surface-raised">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4">
        <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          {label}
        </CardTitle>
        <span className="text-zinc-700">{icon}</span>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="h-8 w-24 bg-surface-overlay" />
        ) : (
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-100">{value}</p>
              {sub && <p className="mt-0.5 text-[10px] text-zinc-600">{sub}</p>}
            </div>
            {sparkData && (
              <div style={{ width: 80, height: 32 }} aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={sparkColor}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Segment Bar Chart ─────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<string, string> = {
  Prime:       "#10b981",
  "Near Prime":"#22d3ee",
  "High Risk": "#f97316",
  "Thin File": "#a855f7",
};

function segmentLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SegmentTooltipPayload {
  value: number;
  payload: { name: string; rate: number };
}

function SegmentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: SegmentTooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const { name, rate } = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-zinc-200">{name}</p>
      <p className="text-zinc-500">Approval Rate: <span className="font-mono text-approve-base">{rate.toFixed(1)}%</span></p>
    </div>
  );
}

function SegmentApprovalChart({
  data,
  loading,
}: {
  data: GovernanceDashboard | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-52 w-full rounded-xl bg-surface-overlay/60" />;
  if (!data) return null;

  const chartData = Object.entries(data.approval_rate_by_segment).map(([key, rate]) => ({
    name: segmentLabel(key),
    rate: rate * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#52525b" }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip content={<SegmentTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} animationDuration={700} animationBegin={0}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={SEGMENT_COLORS[entry.name] ?? "#3366f4"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  data,
  loading,
  period,
  onPeriodChange,
  onRefresh,
}: {
  data: GovernanceDashboard | null;
  loading: boolean;
  period: Period;
  onPeriodChange: (p: Period) => void;
  onRefresh: () => void;
}) {
  const fmtMoney = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct   = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={period} onValueChange={(v) => onPeriodChange(v as Period)}>
          <SelectTrigger className="h-8 w-40 border-surface-border bg-surface-overlay text-sm text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-surface-border bg-surface-overlay text-zinc-200">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-8 gap-1.5 px-2 text-xs text-zinc-500 hover:text-zinc-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Decisions"
          value={data ? String(data.total_decisions) : "—"}
          icon={<Clock className="h-4 w-4" />}
          loading={loading}
          sparkData={data?.trend?.map((t) => ({ v: t.approvals + t.rejections }))}
          sparkColor="#3366f4"
        />
        <KpiCard
          label="Approval Rate"
          value={data ? fmtPct(data.approval_rate) : "—"}
          icon={<CheckCircle2 className="h-4 w-4" />}
          sub={period !== "all_time" ? PERIOD_LABELS[period] : undefined}
          loading={loading}
          sparkData={data?.trend?.map((t) => {
            const total = t.approvals + t.rejections;
            return { v: total > 0 ? (t.approvals / total) * 100 : 0 };
          })}
          sparkColor="#22c55e"
        />
        <KpiCard
          label="Avg Credit Limit"
          value={data ? fmtMoney(data.average_credit_limit) : "—"}
          icon={<DollarSign className="h-4 w-4" />}
          loading={loading}
        />
        <KpiCard
          label="Avg APR"
          value={data ? `${data.average_apr.toFixed(2)}%` : "—"}
          icon={<Percent className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-surface-border bg-surface-raised">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Approval Rate by Segment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SegmentApprovalChart data={data} loading={loading} />
          </CardContent>
        </Card>

        <Card className="border-surface-border bg-surface-raised">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Aggregate Feature Importance (SHAP)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeatureImportanceChart onErrorChange={setFeatureChartError} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const [period, setPeriod] = useState<Period>("last_30_days");
  const [dashboard, setDashboard] = useState<GovernanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureChartError, setFeatureChartError] = useState(false);
  const [biasChartError, setBiasChartError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.governance.dashboard(period, signal);
      setDashboard(data);
    } catch (err) {
      // Ignore AbortError — this is expected when the period changes rapidly
      // and the previous request is cancelled by the cleanup function.
      if (err instanceof Error && err.name === "AbortError") return;
      setError((err as Error).message ?? "Failed to load governance data.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-4 text-sm text-reject-base">
          {error}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="h-9 border border-surface-border bg-surface-raised">
          <TabsTrigger
            value="overview"
            className="text-xs data-[state=active]:bg-surface-overlay data-[state=active]:text-zinc-100"
          >
            Overview
            {featureChartError && (
              <AlertTriangle className="ml-1.5 inline h-3 w-3 text-amber-400" aria-label="Chart error" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="text-xs data-[state=active]:bg-surface-overlay data-[state=active]:text-zinc-100"
          >
            Decision History
          </TabsTrigger>
          <TabsTrigger
            value="bias"
            className="text-xs data-[state=active]:bg-surface-overlay data-[state=active]:text-zinc-100"
          >
            Bias Report
            {biasChartError && (
              <AlertTriangle className="ml-1.5 inline h-3 w-3 text-amber-400" aria-label="Chart error" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            data={dashboard}
            loading={loading}
            period={period}
            onPeriodChange={setPeriod}
            onRefresh={load}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <DecisionHistoryTable />
        </TabsContent>

        <TabsContent value="bias" className="mt-4">
          <BiasIndicatorChart onErrorChange={setBiasChartError} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
