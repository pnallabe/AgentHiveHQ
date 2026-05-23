"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
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
import { Slider } from "@/components/ui/slider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScenarioCNPV {
  base_avg_cnpv: number;
  worsening_avg_cnpv: number;
  recession_avg_cnpv: number;
  weighted_avg_cnpv?: number;
  breakeven_apr?: number;
}

interface PortfolioSummary {
  total_applicants: number;
  approve_count: number;
  manage_price_count: number;
  decline_count: number;
  approve_rate: number;
  expected_portfolio_cnpv: number;
  avg_cnpv_per_approved: number;
  capital_consumed: number;
  remaining_capital: number;
  capital_utilisation_pct: number;
  avg_ftp_rate_approved: number;
  avg_roe_3yr_approved: number;
  cnpv_p10_p50_p90: { p10: number; p50: number; p90: number };
  scenario_comparison: {
    base_avg_cnpv: number;
    worsening_avg_cnpv: number;
    recession_avg_cnpv: number;
  };
}

interface SimulatorResult {
  cnpv_base: number;
  cnpv_worsening: number;
  cnpv_recession: number;
  scenario_weighted_cnpv: number;
  acquisition_signal: "ACQUIRE" | "DECLINE" | "MANAGE_PRICE";
  recommended_apr: number;
  recommended_credit_limit: number;
  capital_required: number;
  capital_check: {
    rwa: number;
    capital_required: number;
    can_originate: boolean;
    capital_headroom_pct: number;
  };
  ftp_breakdown: {
    benchmark_rate: number;
    liquidity_premium_bps: number;
    credit_tier_adj_bps: number;
    scenario_spread_bps: number;
    total_ftp_rate: number;
  };
  sensitivity: {
    cnpv_per_1pp_pd_increase_usd: number;
    cnpv_per_100bps_apr_increase_usd: number;
  };
  monthly_cashflows?: Array<{
    month: number;
    net_cashflow: number;
    pv_cashflow: number;
  }>;
}

interface PolicySummaryResponse {
  portfolio_summary: PortfolioSummary;
  segment_profitability_matrix: Record<string, ScenarioCNPV>;
  ftp_assumptions: {
    benchmark_rate: number;
    hurdle_rate: number;
    scenarios: Record<string, { ftp_spread_bps: number; total_ftp_rate_example_near_prime: number }>;
  };
  capital_assumptions: {
    cet1_target_ratio: number;
    cet1_buffer_available_usd: number;
    lgd_default: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SEGMENT_COLORS: Record<string, string> = {
  prime: "#22c55e",
  near_prime: "#eab308",
  subprime: "#ef4444",
  thin_file: "#8b5cf6",
};

const SIGNAL_BADGE: Record<string, { label: string; className: string }> = {
  ACQUIRE:      { label: "ACQUIRE",      className: "bg-green-500/15 text-green-400 ring-1 ring-green-500/40" },
  MANAGE_PRICE: { label: "MANAGE PRICE", className: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40" },
  DECLINE:      { label: "DECLINE",      className: "bg-red-500/15 text-red-400 ring-1 ring-red-500/40" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = {
  usd:  (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  pct:  (v: number) => `${(v * 100).toFixed(1)}%`,
  bps:  (v: number) => `${Math.round(v * 10000)}bps`,
  pct2: (v: number) => `${(v * 100).toFixed(2)}%`,
};

function cnpvCellColor(cnpv: number): string {
  if (cnpv > 100) return "bg-green-500/15 text-green-300";
  if (cnpv >= 0) return "bg-amber-500/15 text-amber-300";
  return "bg-red-500/15 text-red-300";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/60">
      <CardContent className="pt-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${highlight ? "text-emerald-400" : "text-white"}`}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ScenarioBarChart({
  data,
}: {
  data: Array<{ segment: string; base: number; worsening: number; recession: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="segment" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <YAxis
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          tickFormatter={(v) => `$${v}`}
        />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          labelStyle={{ color: "#fff" }}
          formatter={(v: number) => [`$${v.toFixed(0)}`, ""]}
        />
        <Legend />
        <ReferenceLine y={0}  stroke="#52525b" strokeDasharray="4 2" label={{ value: "Breakeven $0",   fill: "#71717a", fontSize: 10 }} />
        <ReferenceLine y={50} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: "Threshold $50", fill: "#3b82f6", fontSize: 10 }} />
        <Bar dataKey="base"      name="Base"      fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="worsening" name="Worsening" fill="#eab308" radius={[3, 3, 0, 0]} />
        <Bar dataKey="recession" name="Recession" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CashflowChart({ cashflows }: { cashflows: Array<{ month: number; pv_cashflow: number }> }) {
  // Cumulative PV
  let cum = 0;
  const data = cashflows.map((cf) => {
    cum += cf.pv_cashflow;
    return { month: cf.month, cumulative_pv: Math.round(cum) };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 10 }} label={{ value: "Month", position: "insideBottom", offset: -2, fill: "#71717a", fontSize: 10 }} />
        <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
          formatter={(v: number) => [`$${v}`, "Cumulative PV"]}
        />
        <ReferenceLine y={0}  stroke="#52525b" strokeDasharray="4 2" />
        <ReferenceLine y={50} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: "$50", fill: "#3b82f6", fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="cumulative_pv"
          name="Cumulative PV"
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

export default function CCValuationPage() {
  const [summary, setSummary]         = useState<PolicySummaryResponse | null>(null);
  const [summaryLoading, setSumLoad]  = useState(false);
  const [summaryError, setSumError]   = useState<string | null>(null);

  // Simulator state
  const [simBureauScore,    setSimBureauScore]    = useState(695);
  const [simCreditLimit,    setSimCreditLimit]    = useState(7500);
  const [simAPR,            setSimAPR]            = useState(21.99);
  const [simAnnualFee,      setSimAnnualFee]      = useState(0);
  const [simMonthlySpend,   setSimMonthlySpend]   = useState(850);
  const [simAcqCost,        setSimAcqCost]        = useState(115);
  const [simProduct,        setSimProduct]        = useState("cash_back_everyday");
  const [simScenario,       setSimScenario]       = useState("all-three");
  const [simResult,         setSimResult]         = useState<SimulatorResult | null>(null);
  const [simLoading,        setSimLoading]        = useState(false);
  const [simError,          setSimError]          = useState<string | null>(null);
  const [simDebounce,       setSimDebounce]       = useState<ReturnType<typeof setTimeout> | null>(null);

  // Assumptions tab
  const [assumptions,  setAssumptions]  = useState<Record<string, any> | null>(null);
  const [editedAss,    setEditedAss]    = useState<Record<string, any> | null>(null);
  const [assLoading,   setAssLoading]   = useState(false);
  const [assError,     setAssError]     = useState<string | null>(null);
  const [saveLoading,  setSaveLoading]  = useState(false);
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load policy summary
  // ---------------------------------------------------------------------------
  const loadSummary = useCallback(async () => {
    setSumLoad(true);
    setSumError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cc-valuation/policy-summary?period=mtd`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (err: unknown) {
      setSumError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setSumLoad(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ---------------------------------------------------------------------------
  // Policy Simulator — debounced call on input change
  // ---------------------------------------------------------------------------
  const runSimulator = useCallback(async () => {
    setSimLoading(true);
    setSimError(null);
    try {
      const body = {
        mode: "single",
        applicants: [
          {
            application_id:         "SIM_001",
            product_id:             simProduct,
            bureau_score_at_orig:   simBureauScore,
            annual_income_usd:      60000,
            dti:                    0.30,
            requested_credit_limit: simCreditLimit,
            apr_offered:            simAPR / 100,
            annual_fee:             simAnnualFee,
            interchange_rate:       0.019,
            rewards_rate:           0.015,
            monthly_spend_estimated: simMonthlySpend,
            expected_utilisation:   0.45,
            acquisition_cost:       simAcqCost,
            risk_segment:           "near_prime",
            channel:                "digital",
            is_thin_file:           false,
          },
        ],
        include_monthly_cashflows: true,
      };
      const res = await fetch(`${API_BASE}/api/analytics/cc-valuation/origination`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const applicant = data.applicant_results?.[0];
      if (applicant) setSimResult(applicant as SimulatorResult);
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : "Simulator error");
    } finally {
      setSimLoading(false);
    }
  }, [simProduct, simBureauScore, simCreditLimit, simAPR, simAnnualFee, simMonthlySpend, simAcqCost]);

  const triggerSimDebounced = useCallback(() => {
    if (simDebounce) clearTimeout(simDebounce);
    setSimDebounce(setTimeout(runSimulator, 300));
  }, [simDebounce, runSimulator]);

  // Run simulator on input change
  useEffect(() => {
    triggerSimDebounced();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simProduct, simBureauScore, simCreditLimit, simAPR, simAnnualFee, simMonthlySpend, simAcqCost]);

  // ---------------------------------------------------------------------------
  // Assumptions management
  // ---------------------------------------------------------------------------
  const loadAssumptions = useCallback(async () => {
    setAssLoading(true);
    setAssError(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cc-valuation/assumptions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssumptions(data.assumptions);
      setEditedAss(JSON.parse(JSON.stringify(data.assumptions)));
    } catch (err: unknown) {
      setAssError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setAssLoading(false);
    }
  }, []);

  useEffect(() => { loadAssumptions(); }, [loadAssumptions]);

  const saveAssumptions = useCallback(async () => {
    if (!editedAss) return;
    setSaveLoading(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cc-valuation/assumptions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedAss),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAssumptions(data.assumptions);
      setEditedAss(JSON.parse(JSON.stringify(data.assumptions)));
      setSaveMsg("Saved — live on next engine call");
    } catch (err: unknown) {
      setSaveMsg(`Error: ${err instanceof Error ? err.message : "Save failed"}`);
    } finally {
      setSaveLoading(false);
    }
  }, [editedAss]);

  const resetAssumptions = useCallback(async () => {
    setSaveLoading(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/cc-valuation/assumptions/reset`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssumptions(data.assumptions);
      setEditedAss(JSON.parse(JSON.stringify(data.assumptions)));
      setSaveMsg("Reset to env-var defaults");
    } catch (err: unknown) {
      setSaveMsg(`Error: ${err instanceof Error ? err.message : "Reset failed"}`);
    } finally {
      setSaveLoading(false);
    }
  }, []);

  /** Update any scalar field in editedAss by dot-path. e.g. setPath(["ftp","benchmark_rate"], 0.055) */
  const setPath = (path: string[], value: unknown) => {
    setEditedAss(prev => {
      if (!prev) return null;
      const clone: Record<string, any> = JSON.parse(JSON.stringify(prev));
      let obj: Record<string, any> = clone;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return clone;
    });
  };

  // ---------------------------------------------------------------------------
  // Derived chart data
  // ---------------------------------------------------------------------------
  const segmentChartData = summary
    ? Object.entries(summary.segment_profitability_matrix).map(([seg, vals]) => ({
        segment: seg.replace("_", " "),
        base:      vals.base_avg_cnpv,
        worsening: vals.worsening_avg_cnpv,
        recession: vals.recession_avg_cnpv,
      }))
    : [];

  const ps = summary?.portfolio_summary;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            CC Originations Valuation
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            36-month CNPV · Basel III Capital · Three-Scenario Overlay
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-400">
            cc_origination_valuation_v1
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={loadSummary}
            disabled={summaryLoading}
          >
            {summaryLoading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {summaryError && (
        <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {summaryError} — backend may be offline. Showing simulator only.
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="overview"  className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Overview</TabsTrigger>
          <TabsTrigger value="scenarios" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Scenario Analysis</TabsTrigger>
          <TabsTrigger value="simulator"    className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Policy Simulator</TabsTrigger>
          <TabsTrigger value="assumptions" className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white">Assumptions</TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB 1 — OVERVIEW                                                 */}
        {/* ================================================================ */}
        <TabsContent value="overview" className="space-y-6">

          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Approve Rate (MTD)"
              value={ps ? fmt.pct(ps.approve_rate) : "—"}
              sub={ps ? `${ps.approve_count.toLocaleString()} of ${ps.total_applicants.toLocaleString()} applicants` : undefined}
              highlight={!!ps && ps.approve_rate > 0.6}
            />
            <KPICard
              label="Avg Scenario-Wtd CNPV"
              value={ps ? fmt.usd(ps.avg_cnpv_per_approved) : "—"}
              sub="Per approved account"
            />
            <KPICard
              label="Capital Consumed"
              value={ps ? fmt.usd(ps.capital_consumed) : "—"}
              sub={ps ? `${fmt.pct(ps.capital_utilisation_pct ?? 0)} utilised` : undefined}
            />
            <KPICard
              label="Avg ROE (3yr)"
              value={ps ? fmt.pct(ps.avg_roe_3yr_approved) : "—"}
              sub="on ACQUIRE cohort"
            />
          </div>

          {/* Scenario CNPV by Segment bar chart */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">
                CNPV by Risk Segment × Scenario
              </CardTitle>
              <CardDescription className="text-zinc-500 text-xs">
                Bars: average $CNPV per applicant. Blue dashed = $50 acquisition threshold.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {segmentChartData.length > 0 ? (
                <ScenarioBarChart data={segmentChartData} />
              ) : (
                <div className="flex h-[280px] items-center justify-center text-zinc-500 text-sm">
                  {summaryLoading ? "Loading…" : "No segment data available"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capital waterfall + CNPV distribution */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Capital waterfall */}
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">Capital Waterfall</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ps ? (
                  <>
                    {[
                      { label: "CET1 Buffer Available",   value: ps.capital_consumed + ps.remaining_capital, color: "bg-zinc-700" },
                      { label: "Capital Consumed (ACQUIRE)", value: ps.capital_consumed, color: "bg-blue-600" },
                      { label: "Remaining Capital",       value: ps.remaining_capital, color: "bg-emerald-600" },
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
                              width: `${Math.min(100, (row.value / (ps.capital_consumed + ps.remaining_capital)) * 100).toFixed(1)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      {(["base", "industry_worsening", "recession"] as const).map((scen) => {
                        const labels: Record<string, string> = {
                          base: "Base",
                          industry_worsening: "Worsening",
                          recession: "Recession",
                        };
                        const headrooms: Record<string, number> = {
                          base: 1.00,
                          industry_worsening: 0.88,
                          recession: 0.62,
                        };
                        return (
                          <div key={scen} className="rounded border border-zinc-700 p-2">
                            <p className="text-[10px] text-zinc-500">{labels[scen]}</p>
                            <p className="text-xs font-semibold text-white">
                              {fmt.pct(headrooms[scen])} capacity
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
                    {summaryLoading ? "Loading…" : "No data"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CNPV percentiles */}
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">CNPV Distribution (P10 / P50 / P90)</CardTitle>
                <CardDescription className="text-xs text-zinc-500">Scenario-weighted CNPV across all applicants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ps ? (
                  <>
                    {[
                      { label: "P10",  value: ps.cnpv_p10_p50_p90.p10 },
                      { label: "P50",  value: ps.cnpv_p10_p50_p90.p50 },
                      { label: "P90",  value: ps.cnpv_p10_p50_p90.p90 },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-8 text-xs text-zinc-500">{label}</span>
                        <span className={`rounded px-2 py-0.5 text-sm font-mono font-semibold ${cnpvCellColor(value)}`}>
                          ${value.toFixed(0)}
                        </span>
                      </div>
                    ))}
                    <div className="mt-4 border-t border-zinc-800 pt-4 space-y-2">
                      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Scenario avg</p>
                      {[
                        { label: "Base",      value: ps.scenario_comparison.base_avg_cnpv,      color: "text-green-400" },
                        { label: "Worsening", value: ps.scenario_comparison.worsening_avg_cnpv, color: "text-amber-400" },
                        { label: "Recession", value: ps.scenario_comparison.recession_avg_cnpv, color: "text-red-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-zinc-400">{label}</span>
                          <span className={`font-mono font-semibold ${color}`}>${value.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
                    {summaryLoading ? "Loading…" : "No data"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2 — SCENARIO ANALYSIS                                        */}
        {/* ================================================================ */}
        <TabsContent value="scenarios" className="space-y-6">

          {/* Segment Profitability Matrix */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">Segment Profitability Matrix</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Average CNPV per applicant by risk segment and scenario.
                Green = CNPV &gt; $100 · Amber = $0–$100 · Red = &lt; $0
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-3 py-2 text-left text-xs text-zinc-500">Segment</th>
                      {["Base CNPV", "Worsening CNPV", "Recession CNPV", "Wtd CNPV", "Breakeven APR"].map((h) => (
                        <th key={h} className="px-3 py-2 text-right text-xs text-zinc-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary
                      ? Object.entries(summary.segment_profitability_matrix).map(([seg, vals]) => (
                          <tr key={seg} className="border-b border-zinc-800/50">
                            <td className="px-3 py-2 text-xs">
                              <span
                                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{
                                  background: `${SEGMENT_COLORS[seg]}25`,
                                  color: SEGMENT_COLORS[seg],
                                  border: `1px solid ${SEGMENT_COLORS[seg]}50`,
                                }}
                              >
                                {seg.replace("_", " ")}
                              </span>
                            </td>
                            {[vals.base_avg_cnpv, vals.worsening_avg_cnpv, vals.recession_avg_cnpv, vals.weighted_avg_cnpv ?? 0].map((v, i) => (
                              <td key={i} className={`px-3 py-2 text-right text-xs font-mono font-semibold rounded ${cnpvCellColor(v)}`}>
                                ${v.toFixed(0)}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right text-xs font-mono text-zinc-300">
                              {vals.breakeven_apr != null ? fmt.pct2(vals.breakeven_apr) : "—"}
                            </td>
                          </tr>
                        ))
                      : (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-zinc-500 text-xs">
                            {summaryLoading ? "Loading segment data…" : "No data available"}
                          </td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* FTP Assumptions */}
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-zinc-200">FTP Rate Assumptions</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Pool-based matched-maturity FTP. Benchmark = 3-month SOFR proxy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg border border-zinc-800 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Benchmark (SOFR)</p>
                      <p className="mt-1 font-mono text-lg font-bold text-white">
                        {fmt.pct2(summary.ftp_assumptions.benchmark_rate)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Hurdle Rate (WACC)</p>
                      <p className="mt-1 font-mono text-lg font-bold text-white">
                        {fmt.pct2(summary.ftp_assumptions.hurdle_rate)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">LGD (Unsecured)</p>
                      <p className="mt-1 font-mono text-lg font-bold text-white">
                        {fmt.pct(summary.capital_assumptions.lgd_default)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">CET1 Target</p>
                      <p className="mt-1 font-mono text-lg font-bold text-white">
                        {fmt.pct(summary.capital_assumptions.cet1_target_ratio)}
                      </p>
                    </div>
                  </div>

                  <table className="w-full text-xs mt-2">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-3 py-2 text-left text-zinc-500">Scenario</th>
                        <th className="px-3 py-2 text-right text-zinc-500">Spread (bps)</th>
                        <th className="px-3 py-2 text-right text-zinc-500">FTP Near-Prime (example)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary.ftp_assumptions.scenarios).map(([scen, vals]) => (
                        <tr key={scen} className="border-b border-zinc-800/40">
                          <td className="px-3 py-2 capitalize text-zinc-300">{scen.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-200">+{vals.ftp_spread_bps}bps</td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-200">
                            {fmt.pct2(vals.total_ftp_rate_example_near_prime)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  {summaryLoading ? "Loading…" : "Unavailable"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Capital Availability Panel */}
          {summary && (
            <Card className="border-zinc-800 bg-zinc-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-zinc-200">Capital Availability by Scenario</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { scen: "Base",      headroom: 1.00,  color: "text-green-400",  ringColor: "ring-green-500/30" },
                    { scen: "Worsening", headroom: 0.88,  color: "text-amber-400",  ringColor: "ring-amber-500/30" },
                    { scen: "Recession", headroom: 0.62,  color: "text-red-400",    ringColor: "ring-red-500/30" },
                  ].map(({ scen, headroom, color, ringColor }) => {
                    const available = summary.capital_assumptions.cet1_buffer_available_usd * headroom;
                    return (
                      <div key={scen} className={`rounded-lg border border-zinc-800 p-4 ring-1 ${ringColor}`}>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">{scen} Scenario</p>
                        <p className={`mt-1 text-xl font-bold font-mono ${color}`}>
                          {fmt.usd(available)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {fmt.pct(headroom)} of buffer · Headroom multiplier
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3 — POLICY SIMULATOR                                         */}
        {/* ================================================================ */}
        <TabsContent value="simulator" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* Input Form */}
            <div className="space-y-5">
              <Card className="border-zinc-800 bg-zinc-900/60">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-200">Applicant Parameters</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Adjust inputs — CNPV updates in real-time (300ms debounce)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Product */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Product</Label>
                    <Select value={simProduct} onValueChange={setSimProduct}>
                      <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200 text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        {[
                          ["cash_back_everyday",  "Cash Back Everyday"],
                          ["travel_rewards",      "Travel Rewards"],
                          ["classic_unsecured",   "Classic Unsecured"],
                          ["premium_rewards",     "Premium Rewards"],
                          ["student_rewards",     "Student Rewards"],
                          ["secured_starter",     "Secured Starter"],
                          ["elite_metal",         "Elite Metal"],
                        ].map(([val, label]) => (
                          <SelectItem key={val} value={val} className="text-xs text-zinc-200">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bureau Score */}
                  <div className="space-y-1.5">
                    <Label className="flex justify-between text-xs text-zinc-400">
                      <span>Bureau Score</span>
                      <span className="font-mono text-white">{simBureauScore}</span>
                    </Label>
                    <Slider
                      value={[simBureauScore]}
                      onValueChange={([v]) => setSimBureauScore(v)}
                      min={560} max={850} step={5}
                      className="[&_[role=slider]]:bg-indigo-500"
                    />
                  </div>

                  {/* Credit Limit */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Credit Limit (USD)</Label>
                    <Input
                      type="number"
                      value={simCreditLimit}
                      onChange={(e) => setSimCreditLimit(Number(e.target.value))}
                      className="h-8 border-zinc-700 bg-zinc-800 text-xs text-zinc-200"
                    />
                  </div>

                  {/* APR */}
                  <div className="space-y-1.5">
                    <Label className="flex justify-between text-xs text-zinc-400">
                      <span>APR (%)</span>
                      <span className="font-mono text-white">{simAPR.toFixed(2)}%</span>
                    </Label>
                    <Slider
                      value={[simAPR]}
                      onValueChange={([v]) => setSimAPR(parseFloat(v.toFixed(2)))}
                      min={8} max={36} step={0.25}
                      className="[&_[role=slider]]:bg-indigo-500"
                    />
                  </div>

                  {/* Annual Fee */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Annual Fee (USD)</Label>
                    <Input
                      type="number"
                      value={simAnnualFee}
                      onChange={(e) => setSimAnnualFee(Number(e.target.value))}
                      className="h-8 border-zinc-700 bg-zinc-800 text-xs text-zinc-200"
                    />
                  </div>

                  {/* Monthly Spend */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Est. Monthly Spend (USD)</Label>
                    <Input
                      type="number"
                      value={simMonthlySpend}
                      onChange={(e) => setSimMonthlySpend(Number(e.target.value))}
                      className="h-8 border-zinc-700 bg-zinc-800 text-xs text-zinc-200"
                    />
                  </div>

                  {/* Acquisition Cost */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-400">Acquisition Cost (USD)</Label>
                    <Input
                      type="number"
                      value={simAcqCost}
                      onChange={(e) => setSimAcqCost(Number(e.target.value))}
                      className="h-8 border-zinc-700 bg-zinc-800 text-xs text-zinc-200"
                    />
                  </div>

                </CardContent>
              </Card>
            </div>

            {/* Results Panel */}
            <div className="space-y-4">
              {simError && (
                <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                  {simError}
                </div>
              )}

              {simLoading && (
                <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
                  Computing CNPV…
                </div>
              )}

              {simResult && !simLoading && (
                <>
                  {/* CNPV Meter + Signal */}
                  <Card className="border-zinc-800 bg-zinc-900/60">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-zinc-500">
                            Scenario-Weighted CNPV
                          </p>
                          <p className={`mt-1 text-4xl font-bold font-mono ${
                            simResult.scenario_weighted_cnpv >= 50
                              ? "text-green-400"
                              : simResult.scenario_weighted_cnpv >= 0
                                ? "text-amber-400"
                                : "text-red-400"
                          }`}>
                            ${simResult.scenario_weighted_cnpv.toFixed(2)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            Recommended APR: <span className="font-mono text-white">{fmt.pct2(simResult.recommended_apr)}</span>
                          </p>
                        </div>
                        <Badge className={`text-sm px-3 py-1 ${SIGNAL_BADGE[simResult.acquisition_signal]?.className ?? ""}`}>
                          {SIGNAL_BADGE[simResult.acquisition_signal]?.label ?? simResult.acquisition_signal}
                        </Badge>
                      </div>

                      {/* Trio */}
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          { label: "Base",      value: simResult.cnpv_base,      color: "text-green-400" },
                          { label: "Worsening", value: simResult.cnpv_worsening, color: "text-amber-400" },
                          { label: "Recession", value: simResult.cnpv_recession, color: "text-red-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="rounded border border-zinc-700 p-3 text-center">
                            <p className="text-[10px] text-zinc-500">{label}</p>
                            <p className={`font-mono text-lg font-bold ${color}`}>${value.toFixed(0)}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cashflow chart (36 months) */}
                  {simResult.monthly_cashflows && simResult.monthly_cashflows.length > 0 && (
                    <Card className="border-zinc-800 bg-zinc-900/60">
                      <CardHeader>
                        <CardTitle className="text-sm font-semibold text-zinc-200">
                          Cumulative PV Cashflow — 36 Months (Base Scenario)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CashflowChart cashflows={simResult.monthly_cashflows} />
                      </CardContent>
                    </Card>
                  )}

                  {/* Sensitivity + Capital + FTP */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {/* Sensitivity */}
                    <Card className="border-zinc-800 bg-zinc-900/60">
                      <CardHeader>
                        <CardTitle className="text-xs font-semibold text-zinc-200">Sensitivity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">CNPV per +1pp PD</span>
                          <span className={`font-mono font-semibold ${(simResult.sensitivity?.cnpv_per_1pp_pd_increase_usd ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}>
                            ${(simResult.sensitivity?.cnpv_per_1pp_pd_increase_usd ?? 0).toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">CNPV per +100bps APR</span>
                          <span className={`font-mono font-semibold ${(simResult.sensitivity?.cnpv_per_100bps_apr_increase_usd ?? 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                            ${(simResult.sensitivity?.cnpv_per_100bps_apr_increase_usd ?? 0).toFixed(0)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Capital Check */}
                    <Card className="border-zinc-800 bg-zinc-900/60">
                      <CardHeader>
                        <CardTitle className="text-xs font-semibold text-zinc-200">Capital Check</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-400">RWA</span>
                          <span className="font-mono text-white">{fmt.usd(simResult.capital_check.rwa)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Capital Required</span>
                          <span className="font-mono text-white">{fmt.usd(simResult.capital_check.capital_required)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Can Originate</span>
                          <span className={`font-semibold ${simResult.capital_check.can_originate ? "text-green-400" : "text-red-400"}`}>
                            {simResult.capital_check.can_originate ? "✓ Yes" : "✗ No"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* FTP Breakdown */}
                    <Card className="border-zinc-800 bg-zinc-900/60">
                      <CardHeader>
                        <CardTitle className="text-xs font-semibold text-zinc-200">FTP Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {[
                          { label: "Benchmark",      value: simResult.ftp_breakdown.benchmark_rate,         pct: true },
                          { label: "Liquidity Prem", value: simResult.ftp_breakdown.liquidity_premium_bps,   pct: false },
                          { label: "Credit Tier Adj",value: simResult.ftp_breakdown.credit_tier_adj_bps,    pct: false },
                          { label: "Scenario Spread",value: simResult.ftp_breakdown.scenario_spread_bps,    pct: false },
                          { label: "Total FTP",      value: simResult.ftp_breakdown.total_ftp_rate,         pct: true  },
                        ].map(({ label, value, pct }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-zinc-400">{label}</span>
                            <span className="font-mono text-white">
                              {pct ? fmt.pct2(value) : `${value}bps`}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {!simResult && !simLoading && !simError && (
                <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 text-sm">
                  Adjust parameters above to compute CNPV
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        {/* ================================================================ */}
        {/* TAB 4 — ASSUMPTIONS                                              */}
        {/* ================================================================ */}
        <TabsContent value="assumptions" className="space-y-6">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-200">Central Assumptions Registry</p>
              <p className="mt-0.5 text-xs text-zinc-400">
                All model parameters in one place — saved changes apply on the next engine call
                without a server restart.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saveMsg && (
                <span className={`text-xs font-medium ${
                  saveMsg.startsWith("Error") ? "text-red-400" : "text-emerald-400"
                }`}>
                  {saveMsg}
                </span>
              )}
              <Button
                size="sm" variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={resetAssumptions} disabled={saveLoading || assLoading}
              >
                Reset to Defaults
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={saveAssumptions} disabled={saveLoading || !editedAss}
              >
                {saveLoading ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>

          {assError && (
            <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {assError} — backend may be offline.
            </div>
          )}

          {assLoading && !editedAss && (
            <div className="flex h-32 items-center justify-center text-zinc-500 text-sm">
              Loading assumptions…
            </div>
          )}

          {editedAss && (
            <>
              {/* ---- Scenario Configuration ---- */}
              <Card className="border-zinc-800 bg-zinc-900/60">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-200">Scenario Configuration</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Probability weights must sum to 1.0 · Changes to multipliers affect all CNPV projections
                    · Sum: <span className={`font-mono font-bold ${
                      Math.abs(Object.values(editedAss.scenarios as Record<string, any>)
                        .reduce((s: number, sc: any) => s + sc.probability_weight, 0) - 1) < 0.001
                        ? "text-green-400" : "text-red-400"
                    }`}>
                      {Object.values(editedAss.scenarios as Record<string, any>)
                        .reduce((s: number, sc: any) => s + sc.probability_weight, 0).toFixed(3)}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          {["Scenario", "Prob. Weight", "Default Rate Mult", "FTP Spread (bps)",
                            "Capital Headroom", "Spend Vol. Mult", "Payment Rate Mult", "Attrition Mult"
                          ].map(h => (
                            <th key={h} className="px-2 py-2 text-left text-zinc-500 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(editedAss.scenarios as Record<string, any>).map(([key, scen]: [string, any]) => (
                          <tr key={key} className="border-b border-zinc-800/40">
                            <td className="px-2 py-2 font-medium text-zinc-200 whitespace-nowrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                key === "base" ? "bg-green-500/15 text-green-400"
                                : key === "industry_worsening" ? "bg-amber-500/15 text-amber-400"
                                : "bg-red-500/15 text-red-400"
                              }`}>{scen.label}</span>
                            </td>
                            {([
                              ["probability_weight",        0.01, false],
                              ["annual_default_rate_mult",  0.01, false],
                              ["ftp_spread_bps",            5,    true ],
                              ["capital_headroom_pct",      0.01, false],
                              ["spend_volume_mult",         0.01, false],
                              ["payment_rate_mult",         0.01, false],
                              ["attrition_mult",            0.01, false],
                            ] as [string, number, boolean][]).map(([field, step, isInt]) => (
                              <td key={field} className="px-2 py-1">
                                <Input
                                  type="number" step={step}
                                  value={scen[field]}
                                  onChange={e => setPath(
                                    ["scenarios", key, field],
                                    isInt ? parseInt(e.target.value) : parseFloat(e.target.value)
                                  )}
                                  className="h-7 w-20 border-zinc-700 bg-zinc-800 text-center text-xs font-mono text-zinc-200"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* ---- FTP + Capital in 2-col grid ---- */}
              <div className="grid gap-4 lg:grid-cols-2">

                {/* FTP */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-zinc-200">FTP Parameters</CardTitle>
                    <CardDescription className="text-xs text-zinc-500">Pool-based matched-maturity FTP decomposition</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Scalars */}
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ["Benchmark Rate (SOFR)", ["ftp", "benchmark_rate"],  0.0005],
                        ["Hurdle Rate (WACC)",    ["ftp", "hurdle_rate"],     0.0005],
                        ["Prime Score Floor",     ["ftp", "prime_score_floor"], 5   ],
                        ["Near-Prime Floor",      ["ftp", "near_prime_score_floor"], 5],
                      ] as [string, string[], number][]).map(([label, path, step]) => (
                        <div key={label} className="space-y-1">
                          <Label className="text-[10px] text-zinc-400">{label}</Label>
                          <Input
                            type="number" step={step}
                            value={path.reduce((o: any, k) => o?.[k], editedAss)}
                            onChange={e => setPath(path, step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value))}
                            className="h-7 border-zinc-700 bg-zinc-800 text-xs font-mono text-zinc-200"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Credit tier adj */}
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Credit Tier Adjustment (bps)</p>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(editedAss?.ftp?.credit_tier_adj_bps ?? {}).map(([tier, bps]: [string, any]) => (
                          <div key={tier} className="space-y-1">
                            <Label className="text-[10px] capitalize text-zinc-400">{tier.replace("_", " ")}</Label>
                            <Input
                              type="number" step={5} value={bps}
                              onChange={e => setPath(["ftp", "credit_tier_adj_bps", tier], parseInt(e.target.value))}
                              className="h-7 border-zinc-700 bg-zinc-800 text-center text-xs font-mono text-zinc-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Liquidity premiums */}
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Liquidity Premiums by Product (bps)</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(editedAss?.ftp?.liquidity_premium_bps ?? {}).map(([prod, bps]: [string, any]) => (
                          <div key={prod} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-zinc-400 capitalize">{prod.replace(/_/g, " ")}</span>
                            <Input
                              type="number" step={5} value={bps}
                              onChange={e => setPath(["ftp", "liquidity_premium_bps", prod], parseInt(e.target.value))}
                              className="h-6 w-16 border-zinc-700 bg-zinc-800 text-center text-xs font-mono text-zinc-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Capital */}
                <Card className="border-zinc-800 bg-zinc-900/60">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold text-zinc-200">Capital Parameters</CardTitle>
                    <CardDescription className="text-xs text-zinc-500">Basel III Standardised approach</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ["CET1 Target Ratio",    ["capital", "cet1_target_ratio"],        0.005],
                        ["Reserved Buffer Ratio",["capital", "reserved_buffer_ratio"],   0.001],
                        ["CET1 Buffer (USD)",    ["capital", "cet1_buffer_available_usd"], 1000000],
                        ["LGD Default",          ["capital", "lgd_default"],             0.01],
                      ] as [string, string[], number][]).map(([label, path, step]) => (
                        <div key={label} className="space-y-1">
                          <Label className="text-[10px] text-zinc-400">{label}</Label>
                          <Input
                            type="number" step={step}
                            value={path.reduce((o: any, k) => o?.[k], editedAss)}
                            onChange={e => setPath(path, parseFloat(e.target.value))}
                            className="h-7 border-zinc-700 bg-zinc-800 text-xs font-mono text-zinc-200"
                          />
                        </div>
                      ))}
                    </div>
                    {/* Risk weights */}
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Risk Weights by Tier</p>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(editedAss?.capital?.risk_weight_by_tier ?? {}).map(([tier, rw]: [string, any]) => (
                          <div key={tier} className="space-y-1">
                            <Label className="text-[10px] capitalize text-zinc-400">{tier.replace("_", " ")}</Label>
                            <Input
                              type="number" step={0.05} value={rw}
                              onChange={e => setPath(["capital", "risk_weight_by_tier", tier], parseFloat(e.target.value))}
                              className="h-7 border-zinc-700 bg-zinc-800 text-center text-xs font-mono text-zinc-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Utilisation by product */}
                    <div>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Expected Utilisation by Product</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(editedAss?.capital?.expected_utilisation_by_product ?? {}).map(([prod, util]: [string, any]) => (
                          <div key={prod} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-zinc-400 capitalize">{prod.replace(/_/g, " ")}</span>
                            <Input
                              type="number" step={0.01} value={util}
                              onChange={e => setPath(["capital", "expected_utilisation_by_product", prod], parseFloat(e.target.value))}
                              className="h-6 w-16 border-zinc-700 bg-zinc-800 text-center text-xs font-mono text-zinc-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ---- CNPV Model ---- */}
              <Card className="border-zinc-800 bg-zinc-900/60">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-zinc-200">CNPV Model Parameters</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">36-month NPV projection with PD seasoning</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {([
                      ["Horizon (Months)",            ["cnpv", "horizon_months"],                   1],
                      ["Breakeven Threshold ($)",     ["cnpv", "breakeven_threshold_usd"],          1],
                      ["Monthly Op Cost ($)",         ["cnpv", "monthly_operating_cost_usd"],       0.10],
                      ["Recession Decline Floor ($)", ["cnpv", "recession_decline_threshold_usd"],  10],
                      ["Acquire Min CNPV ($)",        ["cnpv", "acquire_signal_minimum_usd"],       1],
                    ] as [string, string[], number][]).map(([label, path, step]) => (
                      <div key={label} className="space-y-1">
                        <Label className="text-[10px] text-zinc-400">{label}</Label>
                        <Input
                          type="number" step={step}
                          value={path.reduce((o: any, k) => o?.[k], editedAss)}
                          onChange={e => setPath(path, parseFloat(e.target.value))}
                          className="h-7 border-zinc-700 bg-zinc-800 text-xs font-mono text-zinc-200"
                        />
                      </div>
                    ))}
                  </div>

                  {/* PD Seasoning curve — compact grid */}
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      PD Seasoning Curve (36 months) — multiplier on flat monthly PD
                    </p>
                    <div className="grid grid-cols-12 gap-1">
                      {(editedAss?.cnpv?.pd_seasoning_curve ?? []).map((v: number, i: number) => (
                        <div key={i} className="space-y-0.5">
                          <p className="text-center text-[9px] text-zinc-600">{i + 1}</p>
                          <Input
                            type="number" step={0.01} value={v}
                            onChange={e => {
                              const arr = [...(editedAss.cnpv.pd_seasoning_curve as number[])];
                              arr[i] = parseFloat(e.target.value);
                              setPath(["cnpv", "pd_seasoning_curve"], arr);
                            }}
                            className="h-7 border-zinc-700 bg-zinc-800 px-1 text-center text-[10px] font-mono text-zinc-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ---- Diff / unsaved changes indicator ---- */}
              {assumptions && JSON.stringify(assumptions) !== JSON.stringify(editedAss) && (
                <div className="rounded-md border border-amber-700 bg-amber-900/10 px-4 py-2 text-xs text-amber-400">
                  You have unsaved changes. Click “Save Changes” to apply them to the live engine.
                </div>
              )}
            </>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
