"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withAuth } from "@/components/layout/with-auth";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Users,
  Globe,
  AlertCircle,
  XCircle,
  TrendingDown,
  Calendar,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DimensionScore {
  name: string;
  display_name: string;
  score: number;
  weight: number;
  zero_tolerance: boolean;
}

interface ComplianceHealthScore {
  overall: number;
  status: "GREEN" | "YELLOW" | "RED";
  dimension_scores: Record<string, number>;
  failing_dimensions: string[];
  computed_at: string;
}

interface ComplianceEvent {
  event_id: string;
  event_type: string;
  source_system: string;
  check_name: string;
  check_result: "PASS" | "FAIL" | "WARN" | "BLOCKED";
  observed_value: number | null;
  threshold_value: number | null;
  threshold_id: string | null;
  decision_id: string | null;
  run_by: string;
  run_at: string;
}

interface RegulatoryHorizonItem {
  horizon_id: string;
  regulation: string;
  jurisdiction: string;
  change_summary: string;
  effective_date: string;
  days_until_effective: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  owner_email: string;
  tracking_status: "BACKLOG" | "IN_REMEDIATION" | "TESTED" | "DEPLOYED";
}

interface SLAStatus {
  sla_id: string;
  sla_name: string;
  regulatory_basis: string;
  target_days: number;
  current_value: number | null;
  warning_threshold: number;
  status: "GREEN" | "YELLOW" | "RED";
  last_checked: string;
}

interface ThirdPartyModel {
  model_id: string;
  vendor: string;
  version: string;
  use_case: string;
  validation_status: "CURRENT" | "OVERDUE";
  last_validated: string | null;
  days_since_validation: number | null;
  sr11_7_compliant: boolean;
  fair_lending_assessment_required: boolean;
}

interface ComplianceDashboardData {
  health_score: ComplianceHealthScore | null;
  recent_events: ComplianceEvent[];
  horizon_items: RegulatoryHorizonItem[];
  sla_statuses: SLAStatus[];
  third_party_models: ThirdPartyModel[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const REFRESH_INTERVAL = 30_000; // 30 seconds

const DIMENSION_LABELS: Record<string, string> = {
  usury_compliance: "Usury Compliance",
  military_lending_compliance: "Military Lending",
  fair_lending_dir: "Fair Lending DIR",
  adverse_action_sla: "Adverse Action SLA",
  tila_disclosure_coverage: "TILA Disclosures",
  model_governance: "Model Governance",
  policy_lifecycle: "Policy Lifecycle",
  audit_completeness: "Audit Completeness",
};

const DIMENSION_WEIGHTS: Record<string, number> = {
  usury_compliance: 0.20,
  military_lending_compliance: 0.15,
  fair_lending_dir: 0.15,
  adverse_action_sla: 0.15,
  tila_disclosure_coverage: 0.10,
  model_governance: 0.10,
  policy_lifecycle: 0.10,
  audit_completeness: 0.05,
};

const ZERO_TOLERANCE_DIMS = new Set(["military_lending_compliance", "adverse_action_sla"]);

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function statusColor(status: "GREEN" | "YELLOW" | "RED", variant: "bg" | "text" | "border" = "bg") {
  const map = {
    GREEN:  { bg: "bg-green-500",  text: "text-green-600",  border: "border-green-500" },
    YELLOW: { bg: "bg-yellow-400", text: "text-yellow-600", border: "border-yellow-400" },
    RED:    { bg: "bg-red-500",    text: "text-red-600",    border: "border-red-500" },
  };
  return map[status][variant];
}

function scoreToStatus(score: number): "GREEN" | "YELLOW" | "RED" {
  return score >= 90 ? "GREEN" : score >= 70 ? "YELLOW" : "RED";
}

function severityBadge(severity: RegulatoryHorizonItem["severity"]) {
  const cls = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH:     "bg-orange-100 text-orange-800 border-orange-300",
    MEDIUM:   "bg-yellow-100 text-yellow-800 border-yellow-300",
    LOW:      "bg-blue-100 text-blue-800 border-blue-300",
  };
  return cls[severity];
}

function checkResultBadge(result: ComplianceEvent["check_result"]) {
  const cls = {
    PASS:    "bg-green-100 text-green-800",
    FAIL:    "bg-red-100 text-red-800",
    WARN:    "bg-yellow-100 text-yellow-800",
    BLOCKED: "bg-red-900 text-white",
  };
  return cls[result] ?? "bg-gray-100 text-gray-800";
}

function trackingStatusBadge(status: RegulatoryHorizonItem["tracking_status"]) {
  const cls = {
    BACKLOG:       "bg-gray-100 text-gray-700",
    IN_REMEDIATION:"bg-blue-100 text-blue-800",
    TESTED:         "bg-purple-100 text-purple-800",
    DEPLOYED:       "bg-green-100 text-green-800",
  };
  return cls[status] ?? "bg-gray-100 text-gray-700";
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchHealthScore(): Promise<ComplianceHealthScore | null> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/analytics/compliance/health-score`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchEvents(resultFilter?: string): Promise<ComplianceEvent[]> {
  try {
    const params = resultFilter ? `?result=${resultFilter}` : "";
    const res = await fetch(`${BACKEND_BASE}/api/analytics/compliance/events${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

async function fetchHorizon(): Promise<RegulatoryHorizonItem[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/analytics/regulatory-horizon`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchSlaStatus(): Promise<SLAStatus[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/analytics/compliance/sla-status`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.slas ?? [];
  } catch {
    return [];
  }
}

async function fetchThirdPartyModels(): Promise<ThirdPartyModel[]> {
  try {
    const res = await fetch(`${BACKEND_BASE}/api/analytics/compliance/third-party-models`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HealthScoreGauge({ score }: { score: ComplianceHealthScore }) {
  const status = score.status;
  const gaugeData = [
    { name: "score", value: score.overall, fill: status === "GREEN" ? "#22c55e" : status === "YELLOW" ? "#facc15" : "#ef4444" },
    { name: "remaining", value: 100 - score.overall, fill: "#f1f5f9" },
  ];

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Platform Compliance Health Score
        </CardTitle>
        <CardDescription>
          Composite score [0–100] across 8 compliance dimensions.
          Computed nightly. Last computed: {new Date(score.computed_at).toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          {/* Gauge */}
          <div className="relative flex-shrink-0">
            <RadialBarChart
              width={200}
              height={200}
              cx={100}
              cy={100}
              innerRadius={70}
              outerRadius={90}
              startAngle={180}
              endAngle={0}
              data={[gaugeData[0]]}
            >
              <RadialBar dataKey="value" cornerRadius={8} />
            </RadialBarChart>
            <div className="absolute inset-0 flex flex-col items-center justify-center mt-4">
              <span className={`text-4xl font-bold ${statusColor(status, "text")}`}>
                {score.overall.toFixed(1)}
              </span>
              <span className={`text-sm font-semibold ${statusColor(status, "text")}`}>
                {status}
              </span>
            </div>
          </div>

          {/* Dimension breakdown */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
              const dimScore = score.dimension_scores[key] ?? 100;
              const dimStatus = scoreToStatus(dimScore);
              const isZeroTol = ZERO_TOLERANCE_DIMS.has(key);
              return (
                <div key={key} className="flex items-center justify-between p-2 rounded-md bg-slate-50 border">
                  <div className="flex items-center gap-1">
                    {dimStatus === "RED" ? (
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    ) : dimStatus === "YELLOW" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span className="text-xs font-medium">{label}</span>
                    {isZeroTol && (
                      <span className="text-xs text-red-500 font-semibold ml-1">0-TOL</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${statusColor(dimStatus, "text")}`}>
                    {dimScore.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {score.failing_dimensions.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" />
              Failing dimensions require immediate attention:
            </p>
            <ul className="mt-1 list-disc list-inside text-sm text-red-600">
              {score.failing_dimensions.map((d) => (
                <li key={d}>{DIMENSION_LABELS[d] ?? d}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventsFeed({
  events,
  onFilterChange,
}: {
  events: ComplianceEvent[];
  onFilterChange: (filter: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Compliance Events
            </CardTitle>
            <CardDescription>Last 24 hours — live feed from compliance_data_plane</CardDescription>
          </div>
          <Select defaultValue="all" onValueChange={onFilterChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All results</SelectItem>
              <SelectItem value="BLOCKED">BLOCKED</SelectItem>
              <SelectItem value="FAIL">FAIL</SelectItem>
              <SelectItem value="WARN">WARN</SelectItem>
              <SelectItem value="PASS">PASS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-green-400" />
            No compliance events matching current filter.
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {events.map((evt) => (
              <div
                key={evt.event_id}
                className="flex items-start justify-between p-3 rounded-md border bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${checkResultBadge(evt.check_result)}`}>
                      {evt.check_result}
                    </Badge>
                    <span className="text-sm font-medium truncate">{evt.check_name}</span>
                    <span className="text-xs text-slate-500">{evt.source_system}</span>
                  </div>
                  {(evt.observed_value !== null || evt.threshold_value !== null) && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      observed: {evt.observed_value?.toFixed(2) ?? "—"} |
                      cap: {evt.threshold_value?.toFixed(2) ?? "—"}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                  {new Date(evt.run_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RegulatoryHorizonTimeline({ items }: { items: RegulatoryHorizonItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Regulatory Horizon
        </CardTitle>
        <CardDescription>Upcoming regulatory changes — next 180 days</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-6 text-slate-500">No upcoming regulatory changes.</div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.horizon_id}
                className="p-3 rounded-md border bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs border ${severityBadge(item.severity)}`}>
                        {item.severity}
                      </Badge>
                      <span className="text-sm font-semibold">{item.regulation}</span>
                      <span className="text-xs text-slate-500">({item.jurisdiction})</span>
                      <Badge className={`text-xs ${trackingStatusBadge(item.tracking_status)}`}>
                        {item.tracking_status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 line-clamp-2">{item.change_summary}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Owner: {item.owner_email}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold ${item.days_until_effective <= 30 ? "text-red-600" : item.days_until_effective <= 90 ? "text-yellow-600" : "text-slate-600"}`}>
                      {item.days_until_effective}d
                    </div>
                    <div className="text-xs text-slate-400">{item.effective_date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SlaTracker({ slas }: { slas: SLAStatus[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          SLA Tracker
        </CardTitle>
        <CardDescription>All compliance SLAs — RAG status</CardDescription>
      </CardHeader>
      <CardContent>
        {slas.length === 0 ? (
          <div className="text-center py-6 text-slate-500">SLA data not available.</div>
        ) : (
          <div className="space-y-2">
            {slas.map((sla) => (
              <div
                key={sla.sla_id}
                className="flex items-center justify-between p-3 rounded-md border bg-white"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{sla.sla_name}</p>
                  <p className="text-xs text-slate-500">{sla.regulatory_basis}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <div className="text-slate-600">
                      Current: {sla.current_value !== null ? `${sla.current_value}d` : "—"}
                    </div>
                    <div className="text-slate-400">
                      Target: {sla.target_days}d
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${statusColor(sla.status)}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ThirdPartyModelsPanel({ models }: { models: ThirdPartyModel[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Third-Party & Vendor Models
        </CardTitle>
        <CardDescription>SR 11-7 validation status — monthly review</CardDescription>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <div className="text-center py-6 text-slate-500">No third-party models registered.</div>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.model_id} className="flex items-center justify-between p-3 rounded-md border bg-white">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.model_id}</span>
                    <Badge
                      className={`text-xs ${
                        m.validation_status === "CURRENT"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {m.validation_status}
                    </Badge>
                    {!m.sr11_7_compliant && (
                      <Badge className="text-xs bg-orange-100 text-orange-800">
                        SR 11-7 pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {m.vendor} v{m.version} — {m.use_case}
                  </p>
                  {m.last_validated && (
                    <p className="text-xs text-slate-400">
                      Last validated: {m.last_validated}
                      {m.days_since_validation !== null && ` (${m.days_since_validation}d ago)`}
                    </p>
                  )}
                </div>
                {m.fair_lending_assessment_required && (
                  <Users className="h-4 w-4 text-blue-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function ComplianceDashboardPage() {
  const [data, setData] = useState<ComplianceDashboardData>({
    health_score: null,
    recent_events: [],
    horizon_items: [],
    sla_statuses: [],
    third_party_models: [],
  });
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [health, events, horizon, slas, thirdParty] = await Promise.all([
      fetchHealthScore(),
      fetchEvents(eventFilter !== "all" ? eventFilter : undefined),
      fetchHorizon(),
      fetchSlaStatus(),
      fetchThirdPartyModels(),
    ]);
    setData({
      health_score: health,
      recent_events: events,
      horizon_items: horizon,
      sla_statuses: slas,
      third_party_models: thirdParty,
    });
    setLastRefreshed(new Date());
    setIsLoading(false);
  }, [eventFilter]);

  // Re-fetch events when filter changes
  useEffect(() => {
    const fetchFiltered = async () => {
      const events = await fetchEvents(eventFilter !== "all" ? eventFilter : undefined);
      setData((prev) => ({ ...prev, recent_events: events }));
    };
    fetchFiltered();
  }, [eventFilter]);

  // Initial load + polling
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Compliance Health Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Section 23 — Compliance-First & Regulatory Platform Architecture
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-slate-400">
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {data.health_score && data.health_score.status === "RED" && (
        <div className="bg-red-600 text-white px-6 py-2 flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4" />
          CRITICAL: Platform compliance score is RED ({data.health_score.overall.toFixed(1)}/100).
          PagerDuty alert should have fired within 5 minutes.
        </div>
      )}

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {/* Row 1: Health Score (spans 2 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.health_score ? (
            <HealthScoreGauge score={data.health_score} />
          ) : (
            <Card className="col-span-2">
              <CardContent className="py-12 text-center text-slate-400">
                {isLoading ? "Loading compliance health score..." : "Health score not available."}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Row 2: Events feed + Horizon */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EventsFeed events={data.recent_events} onFilterChange={setEventFilter} />
          <RegulatoryHorizonTimeline items={data.horizon_items} />
        </div>

        {/* Row 3: SLA Tracker + Third-party models */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SlaTracker slas={data.sla_statuses} />
          <ThirdPartyModelsPanel models={data.third_party_models} />
        </div>

        {/* Compliance Architecture Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Compliance Architecture (Section 23)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { label: "Compliance Data Plane", desc: "23.2 — Read-only regulatory thresholds (never hardcoded)", icon: <Shield className="h-4 w-4 text-blue-500" /> },
                { label: "Real-Time Gate", desc: "23.3 — Synchronous fail-closed gate on every decision", icon: <TrendingDown className="h-4 w-4 text-green-500" /> },
                { label: "RBAC & SoD", desc: "23.8 — Four-eyes enforcement across all privileged actions", icon: <Users className="h-4 w-4 text-purple-500" /> },
                { label: "Compliance CI/CD", desc: "23.5 — 7 pre-flight gates block every non-compliant merge", icon: <CheckCircle className="h-4 w-4 text-teal-500" /> },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-md bg-slate-50 border">
                  <div className="flex items-center gap-1 mb-1">{item.icon}<span className="font-semibold">{item.label}</span></div>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withAuth(ComplianceDashboardPage);
