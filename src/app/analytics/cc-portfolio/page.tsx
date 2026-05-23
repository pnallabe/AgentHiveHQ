"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionStat {
  count: number;
  pct:   number;
}

interface PortfolioSummary {
  total_accounts:       number;
  actions: {
    HOLD:    ActionStat;
    CLI:     ActionStat;
    CLD:     ActionStat;
    APR_UP:  ActionStat;
    APR_DOWN: ActionStat;
  };
  guardrail_override_count: number;
  guardrail_override_pct:   number;
  guardrail_override_reasons: Record<string, number>;
  cnpv_delta_portfolio_total: number;
  cnpv_delta_per_account_avg: number;
  incremental_rwa_usd:        number;
  capital_impact_net_usd:     number;
  segment_breakdown:          Record<string, Record<string, number>>;
}

interface SummaryResponse {
  model_version:                string;
  period:                       string;
  scenario:                     string;
  segment_filter:               string;
  generated_at:                 string;
  portfolio_summary:            PortfolioSummary;
  segment_profitability_matrix: Record<string, {
    CLI_pct: number;
    CLD_pct: number;
    APR_UP_pct: number;
    APR_DOWN_pct: number;
    avg_cnpv_delta?: number;
  }>;
  action_trend_12m: Array<{
    month: string;
    CLI_pct: number;
    CLD_pct: number;
    APR_UP_pct: number;
    APR_DOWN_pct: number;
  }>;
  top_guardrail_reasons: Record<string, number>;
  scenario_cnpv_bridge:  Array<{ action: string; count: number; cnpv_impact: number }>;
  top_cli_products:      Array<{ product_id: string; count: number }>;
  top_cld_triggers:      string[];
  scenario_weights:      Record<string, number>;
}

interface AccountResult {
  model_version:  string;
  origination_id: string;
  reviewed_at:    string;
  account_summary: {
    product_id:           string;
    risk_segment:         string;
    bureau_score_current: number;
    current_credit_limit: number;
    current_apr:          number;
    delinquency_status:   string;
  };
  action_recommendation: {
    final_action:       string;
    action_confidence:  number;
    guardrail_override: boolean;
    guardrail_reason:   string | null;
    new_credit_limit:   number | null;
    new_apr:            number | null;
    limit_change_pct:   number | null;
    apr_change_bps:     number | null;
  };
  cnpv_delta: {
    base:               number | null;
    industry_worsening: number | null;
    recession:          number | null;
    scenario_weighted:  number | null;
  };
  monthly_cashflows_36m: Array<{
    month:                     number;
    current_balance:           number;
    proposed_balance:          number;
    current_monthly_interest:  number;
    proposed_monthly_interest: number;
  }>;
  feature_radar:       Record<string, number>;
  action_probabilities: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ACTION_COLORS: Record<string, string> = {
  HOLD:    "#71717a",
  CLI:     "#22c55e",
  CLD:     "#ef4444",
  APR_UP:  "#f97316",
  APR_DOWN:"#6366f1",
};

const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  HOLD:    { label: "HOLD",    className: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/40" },
  CLI:     { label: "LIMIT ↑", className: "bg-green-500/15 text-green-400 ring-1 ring-green-500/40" },
  CLD:     { label: "LIMIT ↓", className: "bg-red-500/15 text-red-400 ring-1 ring-red-500/40" },
  APR_UP:  { label: "APR ↑",   className: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/40" },
  APR_DOWN:{ label: "APR ↓",   className: "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/40" },
};

const SCENARIO_COLORS: Record<string, string> = {
  base:               "#22c55e",
  industry_worsening: "#eab308",
  recession:          "#ef4444",
};

const SEGMENT_COLORS: Record<string, string> = {
  prime:      "#22c55e",
  near_prime: "#eab308",
  subprime:   "#ef4444",
  thin_file:  "#8b5cf6",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = {
  usd:  (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  pct:  (v: number) => `${(v * 100).toFixed(1)}%`,
  pct2: (v: number) => `${(v * 100).toFixed(2)}%`,
  bps:  (v: number) => `${Math.round(v)}bps`,
  sig:  (v: number) => `${(v * 100).toFixed(0)}%`,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  sub,
  highlight,
  warn,
}: {
  label:      string;
  value:      string;
  sub?:       string;
  highlight?: boolean;
  warn?:      boolean;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/60">
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${
          highlight ? "text-emerald-400" : warn ? "text-orange-400" : "text-white"
        }`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ActionDonut({ summary }: { summary: PortfolioSummary }) {
  const data = Object.entries(summary.actions).map(([action, stat]) => ({
    name:  action,
    value: stat.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
          label={({ name, pct }: { name: string; pct?: number }) =>
            `${name} ${((pct ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={ACTION_COLORS[entry.name] ?? "#52525b"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          formatter={(v: number, name: string) => [v.toLocaleString(), name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ActionTrendChart({
  data,
}: {
  data: SummaryResponse["action_trend_12m"];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          {["CLI", "CLD", "APR_UP", "APR_DOWN"].map((key) => (
            <linearGradient key={key} id={`grad_${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ACTION_COLORS[key]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={ACTION_COLORS[key]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
        <YAxis
          tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          tick={{ fill: "#a1a1aa", fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]}
        />
        <Legend />
        {(["CLI", "CLD", "APR_UP", "APR_DOWN"] as const).map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={`${key}_pct`}
            name={key}
            stroke={ACTION_COLORS[key]}
            fill={`url(#grad_${key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SegmentHeatmapTable({
  matrix,
}: {
  matrix: SummaryResponse["segment_profitability_matrix"];
}) {
  const actions = ["CLI_pct", "CLD_pct", "APR_UP_pct", "APR_DOWN_pct"] as const;
  const actionLabels: Record<string, string> = {
    CLI_pct: "CLI", CLD_pct: "CLD", APR_UP_pct: "APR↑", APR_DOWN_pct: "APR↓",
  };

  function cellBg(action: string, pct: number) {
    if (action === "CLI_pct" && pct > 0.12)   return "bg-green-500/20 text-green-300";
    if (action === "CLD_pct" && pct > 0.06)   return "bg-red-500/20 text-red-300";
    if (action === "APR_UP_pct" && pct > 0.04) return "bg-orange-500/20 text-orange-300";
    return "text-zinc-300";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-3 py-2 text-left text-zinc-500">Segment</th>
            {actions.map((a) => (
              <th key={a} className="px-3 py-2 text-right text-zinc-500">{actionLabels[a]}</th>
            ))}
            <th className="px-3 py-2 text-right text-zinc-500">Avg CNPV Δ</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(matrix).map(([seg, row]) => (
            <tr key={seg} className="border-b border-zinc-800/50">
              <td className="px-3 py-2">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: `${SEGMENT_COLORS[seg] ?? "#52525b"}25`,
                    color:      SEGMENT_COLORS[seg] ?? "#a1a1aa",
                    border:     `1px solid ${SEGMENT_COLORS[seg] ?? "#52525b"}50`,
                  }}
                >
                  {seg.replace("_", " ")}
                </span>
              </td>
              {actions.map((a) => (
                <td key={a} className={`px-3 py-2 text-right font-mono ${cellBg(a, row[a] ?? 0)}`}>
                  {fmt.pct(row[a] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-mono text-zinc-300">
                {row.avg_cnpv_delta != null ? fmt.usd(row.avg_cnpv_delta) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeatureRadar({ data }: { data: Record<string, number> }) {
  const chartData = Object.entries(data).map(([key, val]) => ({
    subject: key.replace(/_/g, " "),
    score:   Math.round(val * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#27272a" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#a1a1aa", fontSize: 9 }} />
        <Radar
          name="Feature Score"
          dataKey="score"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.25}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          formatter={(v: number) => [`${v}%`, "Score"]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function CashflowOverlay({
  data,
}: {
  data: AccountResult["monthly_cashflows_36m"];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="month"
          tick={{ fill: "#a1a1aa", fontSize: 9 }}
          label={{ value: "Month", position: "insideBottom", offset: -2, fill: "#71717a", fontSize: 9 }}
        />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="current_monthly_interest"
          name="Current Interest"
          stroke="#71717a"
          strokeWidth={1.5}
          dot={false}
          strokeDasharray="4 2"
        />
        <Line
          type="monotone"
          dataKey="proposed_monthly_interest"
          name="Proposed Interest"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CCPortfolioPage() {
  // ── Portfolio Overview / Summary tab state ──────────────────────────────
  const [summary, setSummary]       = useState<SummaryResponse | null>(null);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError]     = useState<string | null>(null);
  const [sumPeriod, setSumPeriod]   = useState("mtd");
  const [sumSegment, setSumSegment] = useState("all");

  // ── Scenario tab state ──────────────────────────────────────────────────
  const [scnScenario, setScnScenario] = useState("base");
  const [scnData, setScnData]       = useState<SummaryResponse | null>(null);
  const [scnLoading, setScnLoading] = useState(false);
  const [scnError, setScnError]     = useState<string | null>(null);

  // ── Account Lookup tab state ────────────────────────────────────────────
  const [lookupId, setLookupId]       = useState("");
  const [lookupResult, setLookupResult] = useState<AccountResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState<string | null>(null);

  // ── Run button state ────────────────────────────────────────────────────
  const [runLoading, setRunLoading] = useState(false);
  const [runMsg, setRunMsg]         = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Loaders
  // ---------------------------------------------------------------------------

  const loadSummary = useCallback(async (period: string, segment: string) => {
    setSumLoading(true);
    setSumError(null);
    try {
      const url = `${API_BASE}/api/analytics/cc-portfolio/summary?period=${period}&scenario=base&segment=${segment}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err: unknown) {
      setSumError(err instanceof Error ? err.message : "Failed to load portfolio summary");
    } finally {
      setSumLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary(sumPeriod, sumSegment);
  }, [loadSummary, sumPeriod, sumSegment]);

  const loadScenario = useCallback(async (scenario: string) => {
    setScnLoading(true);
    setScnError(null);
    try {
      const url = `${API_BASE}/api/analytics/cc-portfolio/summary?period=mtd&scenario=${scenario}&segment=all`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScnData(data);
    } catch (err: unknown) {
      setScnError(err instanceof Error ? err.message : "Failed to load scenario data");
    } finally {
      setScnLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenario(scnScenario);
  }, [loadScenario, scnScenario]);

  const runReview = useCallback(async () => {
    setRunLoading(true);
    setRunMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cc-portfolio/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "batch", scenario: "base", output_limit: 500 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      setRunMsg("Review complete — refreshing summary…");
      await loadSummary(sumPeriod, sumSegment);
      setRunMsg("Done.");
    } catch (err: unknown) {
      setRunMsg(`Error: ${err instanceof Error ? err.message : "Review failed"}`);
    } finally {
      setRunLoading(false);
    }
  }, [loadSummary, sumPeriod, sumSegment]);

  const lookupAccount = useCallback(async () => {
    if (!lookupId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/analytics/cc-portfolio/account/${encodeURIComponent(lookupId.trim())}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLookupResult(data);
    } catch (err: unknown) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }, [lookupId]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const ps = summary?.portfolio_summary;

  const actionDonutAvailable = !!ps?.actions;

  const guardrailBarData = summary
    ? Object.entries(summary.top_guardrail_reasons).map(([reason, count]) => ({
        reason: reason.replace(/_/g, " ").slice(0, 24),
        count,
      }))
    : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            CC Portfolio Management
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Monthly CLI / CLD / APR Review · GradientBoostingClassifier · Hard Guardrails · CNPV Gate
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-400">
            cc_portfolio_action_v1
          </Badge>
          {runMsg && (
            <span className={`text-xs font-medium ${
              runMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"
            }`}>
              {runMsg}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => loadSummary(sumPeriod, sumSegment)}
            disabled={sumLoading}
          >
            {sumLoading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={runReview}
            disabled={runLoading}
          >
            {runLoading ? "Running…" : "Run Monthly Review"}
          </Button>
        </div>
      </div>

      {sumError && (
        <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {sumError} — backend may be offline.
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="border border-zinc-800 bg-zinc-900">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Portfolio Overview
          </TabsTrigger>
          <TabsTrigger
            value="scenarios"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Scenario Comparison
          </TabsTrigger>
          <TabsTrigger
            value="lookup"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Account Lookup
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1 — PORTFOLIO OVERVIEW                                      */}
        {/* ============================================================== */}
        <TabsContent value="overview" className="space-y-6">

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-zinc-400">Period</Label>
              <Select value={sumPeriod} onValueChange={setSumPeriod}>
                <SelectTrigger className="h-8 w-28 border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900">
                  <SelectItem value="mtd"        className="text-xs text-zinc-200">MTD</SelectItem>
                  <SelectItem value="last_month" className="text-xs text-zinc-200">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-zinc-400">Segment</Label>
              <Select value={sumSegment} onValueChange={setSumSegment}>
                <SelectTrigger className="h-8 w-28 border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900">
                  <SelectItem value="all"       className="text-xs text-zinc-200">All</SelectItem>
                  <SelectItem value="prime"     className="text-xs text-zinc-200">Prime</SelectItem>
                  <SelectItem value="near_prime"className="text-xs text-zinc-200">Near Prime</SelectItem>
                  <SelectItem value="subprime"  className="text-xs text-zinc-200">Subprime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {(["CLI", "CLD", "APR_UP", "APR_DOWN", "HOLD"] as const).map((action) => {
              const stat = ps?.actions?.[action];
              return (
                <KPICard
                  key={action}
                  label={ACTION_BADGE[action]?.label ?? action}
                  value={stat ? stat.count.toLocaleString() : "—"}
                  sub={stat ? fmt.pct(stat.pct) : undefined}
                  highlight={action === "CLI"}
                  warn={action === "CLD" || action === "APR_UP"}
                />
              );
            })}
          </div>

          {/* CNPV + Capital KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Total Accounts"
              value={ps ? ps.total_accounts.toLocaleString() : "—"}
              sub="Active review batch"
            />
            <KPICard
              label="Avg CNPV Delta"
              value={ps ? fmt.usd(ps.cnpv_delta_per_account_avg) : "—"}
              sub="Per account, scenario weighted"
              highlight={!!ps && ps.cnpv_delta_per_account_avg > 0}
            />
            <KPICard
              label="Guardrail Overrides"
              value={ps ? fmt.pct(ps.guardrail_override_pct) : "—"}
              sub={ps ? `${ps.guardrail_override_count.toLocaleString()} accounts` : undefined}
              warn={!!ps && ps.guardrail_override_pct > 0.15}
            />
            <KPICard
              label="Net Capital Impact"
              value={ps ? fmt.usd(ps.capital_impact_net_usd) : "—"}
              sub={ps ? `RWA: ${fmt.usd(ps.incremental_rwa_usd)}` : undefined}
            />
          </div>

          {/* Action Donut + 12m Trend */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Action Distribution
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Current review cycle · 5-class output
                </CardDescription>
              </CardHeader>
              <CardContent>
                {actionDonutAvailable ? (
                  <ActionDonut summary={ps!} />
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-zinc-500 text-sm">
                    {sumLoading ? "Loading…" : "No data"}
                  </div>
                )}
                {/* Legend */}
                {ps && (
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
                    {(["HOLD", "CLI", "CLD", "APR_UP", "APR_DOWN"] as const).map((a) => (
                      <div key={a} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: ACTION_COLORS[a] }}
                        />
                        {a} · {fmt.pct(ps.actions[a]?.pct ?? 0)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  12-Month Action Rate Trend
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Monthly % of active accounts receiving each action
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.action_trend_12m?.length ? (
                  <ActionTrendChart data={summary.action_trend_12m} />
                ) : (
                  <div className="flex h-[240px] items-center justify-center text-zinc-500 text-sm">
                    {sumLoading ? "Loading…" : "No trend data"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Guardrail Override chart + Capital bar */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Top Guardrail Override Reasons
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Accounts where model recommendation was overridden by policy rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                {guardrailBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={guardrailBarData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 9 }} />
                      <YAxis
                        type="category"
                        dataKey="reason"
                        width={130}
                        tick={{ fill: "#a1a1aa", fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                        }}
                        formatter={(v: number) => [v.toLocaleString(), "Accounts"]}
                      />
                      <Bar dataKey="count" name="Accounts" fill="#f97316" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-zinc-500 text-sm">
                    {sumLoading ? "Loading…" : "No guardrail data"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Capital Impact progress bar */}
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Capital Impact Summary
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Incremental RWA from CLI actions vs CET1 buffer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ps ? (
                  <>
                    {[
                      {
                        label: "Incremental RWA (CLI)",
                        value: ps.incremental_rwa_usd,
                        max:   500_000_000,
                        color: "bg-green-600",
                      },
                      {
                        label: "Net Capital Impact",
                        value: Math.abs(ps.capital_impact_net_usd),
                        max:   500_000_000,
                        color: ps.capital_impact_net_usd < 0 ? "bg-red-600" : "bg-blue-600",
                      },
                    ].map((row) => (
                      <div key={row.label} className="space-y-1">
                        <div className="flex justify-between text-xs text-zinc-400">
                          <span>{row.label}</span>
                          <span className="font-mono text-white">{fmt.usd(row.value)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-zinc-800">
                          <div
                            className={`h-2 rounded-full ${row.color}`}
                            style={{
                              width: `${Math.min(100, (row.value / row.max) * 100).toFixed(1)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Top CLI products */}
                    {summary && summary.top_cli_products.length > 0 && (
                      <div className="mt-4 border-t border-zinc-800 pt-4">
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                          Top CLI Products
                        </p>
                        <div className="space-y-1">
                          {summary.top_cli_products.map((p) => (
                            <div key={p.product_id} className="flex justify-between text-xs">
                              <span className="capitalize text-zinc-400">
                                {p.product_id.replace(/_/g, " ")}
                              </span>
                              <span className="font-mono text-white">
                                {p.count.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-40 items-center justify-center text-zinc-500 text-sm">
                    {sumLoading ? "Loading…" : "No data"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Segment CNPV Delta bar chart */}
          {summary && Object.keys(summary.segment_profitability_matrix).length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">
                  Action Rate by Segment
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  % of accounts per segment receiving each action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SegmentHeatmapTable matrix={summary.segment_profitability_matrix} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2 — SCENARIO COMPARISON                                     */}
        {/* ============================================================== */}
        <TabsContent value="scenarios" className="space-y-6">

          {/* Scenario selector */}
          <div className="flex flex-wrap items-center gap-4">
            <Label className="text-xs text-zinc-400">Active Scenario</Label>
            <div className="flex gap-2">
              {(["base", "industry_worsening", "recession"] as const).map((scen) => (
                <Button
                  key={scen}
                  size="sm"
                  variant="outline"
                  onClick={() => setScnScenario(scen)}
                  className={`border-zinc-700 text-xs capitalize ${
                    scnScenario === scen
                      ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                      : "text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {scen === "industry_worsening" ? "Worsening" : scen.charAt(0).toUpperCase() + scen.slice(1)}
                </Button>
              ))}
            </div>
            {scnError && (
              <span className="text-xs text-red-400">{scnError}</span>
            )}
          </div>

          {/* Scenario weights */}
          {scnData && (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(scnData.scenario_weights).map(([scen, weight]) => (
                <Card key={scen} className="border-zinc-800 bg-zinc-900/60">
                  <CardContent className="pt-4">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {scen.replace(/_/g, " ")}
                    </p>
                    <p
                      className="mt-1 text-xl font-bold font-mono"
                      style={{ color: SCENARIO_COLORS[scen] ?? "#fff" }}
                    >
                      {fmt.pct(weight)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-500">Probability weight</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Segment × Action heatmap */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Segment × Action Rate — {scnScenario.replace(/_/g, " ")} Scenario
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                High CLI % in subprime = elevated guardrail override risk
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scnLoading ? (
                <div className="flex h-40 items-center justify-center text-zinc-500 text-sm">
                  Loading scenario data…
                </div>
              ) : scnData && Object.keys(scnData.segment_profitability_matrix).length > 0 ? (
                <SegmentHeatmapTable matrix={scnData.segment_profitability_matrix} />
              ) : (
                <div className="flex h-40 items-center justify-center text-zinc-500 text-sm">
                  No segment data — run Monthly Review first
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guardrail override bar — by scenario */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                Guardrail Override Reasons — {scnScenario.replace(/_/g, " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scnData && Object.keys(scnData.top_guardrail_reasons).length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(scnData.top_guardrail_reasons).map(([r, c]) => ({
                      reason: r.replace(/_/g, " ").slice(0, 28),
                      count:  c,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 9 }} />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={140}
                      tick={{ fill: "#a1a1aa", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Accounts"
                      fill={SCENARIO_COLORS[scnScenario] ?? "#f97316"}
                      radius={[0, 3, 3, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-zinc-500 text-sm">
                  {scnLoading ? "Loading…" : "No data"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3-column scenario sensitivity panel */}
          {scnData && (
            <div className="grid gap-4 sm:grid-cols-3">
              {(["base", "industry_worsening", "recession"] as const).map((scen) => {
                const matrix = scnData.segment_profitability_matrix;
                const cliPct = Object.values(matrix).reduce(
                  (acc, row) => acc + (row.CLI_pct ?? 0), 0
                ) / Math.max(Object.keys(matrix).length, 1);
                const cldPct = Object.values(matrix).reduce(
                  (acc, row) => acc + (row.CLD_pct ?? 0), 0
                ) / Math.max(Object.keys(matrix).length, 1);
                return (
                  <Card key={scen} className="border-zinc-800 bg-zinc-900/60">
                    <CardHeader>
                      <CardTitle
                        className="text-xs font-semibold capitalize"
                        style={{ color: SCENARIO_COLORS[scen] ?? "#fff" }}
                      >
                        {scen.replace(/_/g, " ")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Avg CLI rate</span>
                        <span className="font-mono text-green-400">{fmt.pct(cliPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Avg CLD rate</span>
                        <span className="font-mono text-red-400">{fmt.pct(cldPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Probability</span>
                        <span
                          className="font-mono font-bold"
                          style={{ color: SCENARIO_COLORS[scen] ?? "#fff" }}
                        >
                          {fmt.pct(scnData.scenario_weights[scen] ?? 0)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3 — ACCOUNT LOOKUP                                          */}
        {/* ============================================================== */}
        <TabsContent value="lookup" className="space-y-6">

          {/* Search bar */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">Account Search</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Enter an origination ID or customer ID to retrieve the latest portfolio review decision
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Input
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") lookupAccount(); }}
                  placeholder="e.g. ACCT-00123456 or ACC_00001"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
                />
                <Button
                  onClick={lookupAccount}
                  disabled={lookupLoading || !lookupId.trim()}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {lookupLoading ? "Searching…" : "Search"}
                </Button>
              </div>
              {lookupError && (
                <p className="mt-3 text-sm text-red-400">{lookupError}</p>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {lookupResult && (
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-zinc-200">
                    {lookupResult.origination_id}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {lookupResult.account_summary.product_id?.replace(/_/g, " ")} ·{" "}
                    <span
                      style={{ color: SEGMENT_COLORS[lookupResult.account_summary.risk_segment ?? ""] }}
                    >
                      {lookupResult.account_summary.risk_segment?.replace("_", " ")}
                    </span>{" "}
                    · Reviewed {new Date(lookupResult.reviewed_at).toLocaleString()}
                  </p>
                </div>
                <Badge
                  className={`text-sm px-3 py-1 ${
                    ACTION_BADGE[lookupResult.action_recommendation.final_action]?.className ?? ""
                  }`}
                >
                  {ACTION_BADGE[lookupResult.action_recommendation.final_action]?.label ??
                    lookupResult.action_recommendation.final_action}
                </Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                {/* Account Summary */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Account Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {[
                      [
                        "Bureau Score",
                        lookupResult.account_summary.bureau_score_current?.toString() ?? "—",
                      ],
                      [
                        "Current Limit",
                        fmt.usd(lookupResult.account_summary.current_credit_limit ?? 0),
                      ],
                      ["Current APR", fmt.pct2(lookupResult.account_summary.current_apr ?? 0)],
                      [
                        "Delinquency",
                        lookupResult.account_summary.delinquency_status ?? "—",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-zinc-400">{label}</span>
                        <span className="font-mono text-white">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Recommendation */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Recommended Action
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {[
                      [
                        "Action",
                        lookupResult.action_recommendation.final_action,
                      ],
                      [
                        "Confidence",
                        fmt.sig(lookupResult.action_recommendation.action_confidence ?? 0),
                      ],
                      [
                        "Guardrail Override",
                        lookupResult.action_recommendation.guardrail_override ? "Yes" : "No",
                      ],
                      [
                        "New Limit",
                        lookupResult.action_recommendation.new_credit_limit != null
                          ? fmt.usd(lookupResult.action_recommendation.new_credit_limit)
                          : "—",
                      ],
                      [
                        "New APR",
                        lookupResult.action_recommendation.new_apr != null
                          ? fmt.pct2(lookupResult.action_recommendation.new_apr)
                          : "—",
                      ],
                      [
                        "Limit Change",
                        lookupResult.action_recommendation.limit_change_pct != null
                          ? fmt.pct(lookupResult.action_recommendation.limit_change_pct)
                          : "—",
                      ],
                      [
                        "APR Change",
                        lookupResult.action_recommendation.apr_change_bps != null
                          ? fmt.bps(lookupResult.action_recommendation.apr_change_bps)
                          : "—",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-zinc-400">{label}</span>
                        <span
                          className={`font-mono font-semibold ${
                            label === "Guardrail Override" && value === "Yes"
                              ? "text-orange-400"
                              : "text-white"
                          }`}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                    {lookupResult.action_recommendation.guardrail_reason && (
                      <div className="mt-2 rounded border border-orange-800/50 bg-orange-900/10 px-2 py-1.5 text-[10px] text-orange-400">
                        Override: {lookupResult.action_recommendation.guardrail_reason}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* CNPV Delta Trio */}
              <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
                {(
                  [
                    { label: "Base CNPV Δ",      value: lookupResult.cnpv_delta.base,               color: SCENARIO_COLORS.base },
                    { label: "Worsening CNPV Δ", value: lookupResult.cnpv_delta.industry_worsening,  color: SCENARIO_COLORS.industry_worsening },
                    { label: "Recession CNPV Δ", value: lookupResult.cnpv_delta.recession,           color: SCENARIO_COLORS.recession },
                    { label: "Scenario Weighted",value: lookupResult.cnpv_delta.scenario_weighted,   color: "#6366f1" },
                  ] as { label: string; value: number | null; color: string }[]
                ).map(({ label, value, color }) => (
                  <Card key={label} className="border-zinc-800 bg-zinc-900/60">
                    <CardContent className="pt-4">
                      <p className="text-[10px] text-zinc-500">{label}</p>
                      <p className="mt-1 text-lg font-bold font-mono" style={{ color }}>
                        {value != null ? fmt.usd(value) : "—"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                {/* Feature Radar */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Feature Profile (normalised [0, 1])
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      8 key behavioural features · Higher = stronger signal for CLI
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FeatureRadar data={lookupResult.feature_radar} />
                  </CardContent>
                </Card>

                {/* Action Probabilities */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-xs font-semibold text-zinc-200">
                      Action Probabilities (pre-guardrail)
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      GradientBoostingClassifier soft output
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    {Object.entries(lookupResult.action_probabilities).map(([action, prob]) => (
                      <div key={action} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-400">{action}</span>
                          <span
                            className="font-mono font-semibold"
                            style={{ color: ACTION_COLORS[action] ?? "#fff" }}
                          >
                            {fmt.sig(prob)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-800">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width:      `${(prob * 100).toFixed(1)}%`,
                              background: ACTION_COLORS[action] ?? "#6366f1",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* 36-month Cashflow Overlay */}
              {lookupResult.monthly_cashflows_36m?.length > 0 && (
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-zinc-200">
                      36-Month Interest Cashflow — Current vs Proposed
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Monthly interest under current vs proposed limit/APR configuration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CashflowOverlay data={lookupResult.monthly_cashflows_36m} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Empty state */}
          {!lookupResult && !lookupLoading && !lookupError && (
            <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 text-sm">
              Enter an account ID above to view portfolio review results
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
