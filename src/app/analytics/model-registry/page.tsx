"use client";

import { useState, useEffect, useCallback } from "react";
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
  Download,
  RefreshCw,
  Shield,
  Database,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelVersionInfo {
  version: string;
  stage: string;
  created_at: string;
  tags: Record<string, string>;
}

interface ModelSummary {
  model_name: string;
  current_stage: string;
  latest_version: string;
  thresholds: Record<string, number>;
  review_cycle_months: number;
  fair_lending_required: boolean;
  model_owner_email: string;
  sr117_stage: string;
  governance_status: string;
  last_promoted_at: string | null;
  next_review_due: string | null;
}

interface ModelDetail {
  model_name: string;
  current_stage: string;
  versions: ModelVersionInfo[];
  thresholds: Record<string, number>;
  review_cycle_months: number;
  fair_lending_required: boolean;
  model_owner_email: string;
  sr117_stage: string;
  champion_version: string | null;
  challenger_version: string | null;
}

interface GovernanceAuditEntry {
  id: string;
  model_name: string;
  action: string;
  new_stage: string | null;
  performed_by: string;
  rationale: string;
  metrics_snapshot: Record<string, number>;
  created_at: string;
}

interface ValidationEntry {
  id: string;
  model_name: string;
  validator_id: string;
  outcome: string;
  findings: Record<string, unknown>;
  validated_at: string;
}

interface AdverseActionNotice {
  id: string;
  application_id: string;
  model_name: string;
  reason_codes: string[];
  status: string;
  enqueued_at: string;
  dispatch_deadline: string;
  overdue: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  cc_pd_model: "CC PD Model",
  cc_origination_valuation: "CC Origination Valuation",
  cc_portfolio_action: "CC Portfolio Action",
  mortgage_valuation_model: "Mortgage Valuation Model",
};

const STAGE_COLORS: Record<string, string> = {
  Production: "bg-green-100 text-green-800 border-green-200",
  Staging: "bg-amber-100 text-amber-800 border-amber-200",
  development: "bg-blue-100 text-blue-800 border-blue-200",
  independent_validation: "bg-purple-100 text-purple-800 border-purple-200",
  mrm_approval: "bg-orange-100 text-orange-800 border-orange-200",
  sunset: "bg-gray-100 text-gray-600 border-gray-200",
  None: "bg-gray-100 text-gray-500 border-gray-200",
};

const SR117_STAGE_ORDER = [
  "development",
  "independent_validation",
  "mrm_approval",
  "production",
  "sunset",
];

const API_BASE = "/api/analytics/mrm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reviewDueStatus(dateStr: string | null): "overdue" | "soon" | "ok" | "unknown" {
  if (!dateStr) return "unknown";
  const due = new Date(dateStr);
  const now = new Date();
  const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 30) return "soon";
  return "ok";
}

function ReviewDueBadge({ date }: { date: string | null }) {
  const status = reviewDueStatus(date);
  const formatted = formatDate(date);
  if (status === "overdue")
    return <span className="text-red-600 font-semibold">{formatted} ⚠</span>;
  if (status === "soon")
    return <span className="text-amber-600 font-medium">{formatted}</span>;
  if (status === "ok")
    return <span className="text-green-700">{formatted}</span>;
  return <span className="text-gray-400">—</span>;
}

function StageBadge({ stage }: { stage: string }) {
  const cls = STAGE_COLORS[stage] ?? "bg-gray-100 text-gray-500 border-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {stage}
    </span>
  );
}

function MetricRow({
  label,
  value,
  threshold,
  higherIsBetter = true,
}: {
  label: string;
  value: number | undefined;
  threshold: number | undefined;
  higherIsBetter?: boolean;
}) {
  if (value === undefined) return null;
  const passing =
    threshold === undefined
      ? true
      : higherIsBetter
      ? value >= threshold
      : value <= threshold;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-mono font-medium ${passing ? "text-green-700" : "text-red-600"}`}>
        {value.toFixed(4)}
        {threshold !== undefined && (
          <span className="ml-1 text-xs text-gray-400">
            ({higherIsBetter ? "≥" : "≤"} {threshold})
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accent?: "green" | "amber" | "red" | "blue";
}) {
  const accentMap = {
    green: "text-green-600 bg-green-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
    blue: "text-blue-600 bg-blue-50",
  };
  const iconCls = accentMap[accent ?? "blue"];
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`rounded-full p-3 ${iconCls}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Registry Overview
// ---------------------------------------------------------------------------

function RegistryOverview({
  models,
  adverseAction,
  onSelectModel,
  loading,
}: {
  models: ModelSummary[];
  adverseAction: AdverseActionNotice[];
  onSelectModel: (name: string) => void;
  loading: boolean;
}) {
  const productionCount = models.filter((m) => m.current_stage === "Production").length;
  const pendingValidation = models.filter((m) =>
    ["development", "independent_validation", "mrm_approval"].includes(m.sr117_stage)
  ).length;
  const reviewsDue = models.filter(
    (m) => reviewDueStatus(m.next_review_due) === "overdue" || reviewDueStatus(m.next_review_due) === "soon"
  ).length;
  const overdueNotices = adverseAction.filter((n) => n.overdue).length;

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Registered Models"
          value={models.length}
          subtitle="Across all model families"
          icon={Database}
          accent="blue"
        />
        <KpiCard
          title="Production Models"
          value={productionCount}
          subtitle="Fully approved & live"
          icon={CheckCircle}
          accent="green"
        />
        <KpiCard
          title="Pending Validation"
          value={pendingValidation}
          subtitle="In SR 11-7 pipeline"
          icon={Clock}
          accent="amber"
        />
        <KpiCard
          title="Reviews Due"
          value={reviewsDue}
          subtitle="Overdue or within 30 days"
          icon={AlertTriangle}
          accent={reviewsDue > 0 ? "red" : "green"}
        />
      </div>

      {/* Model Status Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Model Registry — All Models
          </CardTitle>
          <CardDescription>
            SR 11-7 lifecycle stage and governance status for all registered models
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading models…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Model Name</th>
                    <th className="text-left p-3 font-medium">MLflow Stage</th>
                    <th className="text-left p-3 font-medium">SR 11-7 Stage</th>
                    <th className="text-left p-3 font-medium">Latest Version</th>
                    <th className="text-left p-3 font-medium">Last Promoted</th>
                    <th className="text-left p-3 font-medium">Next Review</th>
                    <th className="text-left p-3 font-medium">Governance</th>
                    <th className="text-left p-3 font-medium">Fair Lending</th>
                    <th className="text-left p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr
                      key={m.model_name}
                      className="border-b hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => onSelectModel(m.model_name)}
                    >
                      <td className="p-3 font-medium">
                        {MODEL_DISPLAY_NAMES[m.model_name] ?? m.model_name}
                        <div className="text-xs text-muted-foreground font-mono">
                          {m.model_name}
                        </div>
                      </td>
                      <td className="p-3">
                        <StageBadge stage={m.current_stage} />
                      </td>
                      <td className="p-3">
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 font-semibold">
                          {m.sr117_stage}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">{m.latest_version ?? "—"}</td>
                      <td className="p-3 text-xs text-gray-600">
                        {formatDate(m.last_promoted_at)}
                      </td>
                      <td className="p-3 text-xs">
                        <ReviewDueBadge date={m.next_review_due} />
                      </td>
                      <td className="p-3">
                        {m.governance_status === "PASS" ? (
                          <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                            <CheckCircle className="h-3.5 w-3.5" /> PASS
                          </span>
                        ) : m.governance_status === "PENDING" ? (
                          <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <Clock className="h-3.5 w-3.5" /> PENDING
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />{" "}
                            {m.governance_status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {m.fair_lending_required ? (
                          <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                            ECOA
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adverse Action SLA Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Adverse Action Notice — SLA Status
          </CardTitle>
          <CardDescription>
            FCRA/ECOA 30-day dispatch requirement across all models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{adverseAction.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Pending</p>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${overdueNotices > 0 ? "text-red-600" : "text-green-600"}`}>
                {overdueNotices}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Overdue</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {adverseAction.length > 0
                  ? formatDate(
                      adverseAction
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(a.dispatch_deadline).getTime() -
                            new Date(b.dispatch_deadline).getTime()
                        )[0]?.dispatch_deadline
                    )
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Next Deadline</p>
            </div>
          </div>
          {overdueNotices > 0 && (
            <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{overdueNotices} notice{overdueNotices > 1 ? "s are" : " is"} overdue.</strong> Navigate to the{" "}
                <strong>Compliance</strong> tab to view and export the queue.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Model Detail
// ---------------------------------------------------------------------------

function ModelDetailTab({
  models,
  selectedModelName,
  onSelectModel,
}: {
  models: ModelSummary[];
  selectedModelName: string | null;
  onSelectModel: (name: string) => void;
}) {
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [validations, setValidations] = useState<ValidationEntry[]>([]);
  const [auditLog, setAuditLog] = useState<GovernanceAuditEntry[]>([]);
  const [expandedValidation, setExpandedValidation] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchDetail = useCallback(async (name: string) => {
    setLoadingDetail(true);
    try {
      const [detailRes, valRes, auditRes] = await Promise.all([
        fetch(`${API_BASE}/models/${name}`),
        fetch(`${API_BASE}/models/${name}/validations`),
        fetch(`${API_BASE}/models/${name}/audit?limit=20`),
      ]);
      if (detailRes.ok) setDetail(await detailRes.json());
      if (valRes.ok) setValidations(await valRes.json());
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAuditLog(d.items ?? d);
      }
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedModelName) fetchDetail(selectedModelName);
  }, [selectedModelName, fetchDetail]);

  const downloadModelCard = () => {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${detail.model_name}_model_card.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Model Selector */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select
                value={selectedModelName ?? ""}
                onValueChange={onSelectModel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model to inspect…" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.model_name} value={m.model_name}>
                      {MODEL_DISPLAY_NAMES[m.model_name] ?? m.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {detail && (
              <Button variant="outline" size="sm" onClick={downloadModelCard}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Model Card JSON
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loadingDetail && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Loading model detail…
        </div>
      )}

      {!loadingDetail && !detail && !selectedModelName && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          Select a model above to view its detail.
        </div>
      )}

      {detail && !loadingDetail && (
        <>
          {/* Section A: Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Model Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Model Name</p>
                  <p className="font-mono font-medium">{detail.model_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">MLflow Stage</p>
                  <StageBadge stage={detail.current_stage} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">SR 11-7 Stage</p>
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 font-semibold">
                    {detail.sr117_stage}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Review Cycle</p>
                  <p className="font-medium">{detail.review_cycle_months} months</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Model Owner</p>
                  <p className="font-medium">{detail.model_owner_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fair Lending</p>
                  <p className={`font-medium ${detail.fair_lending_required ? "text-orange-600" : "text-gray-500"}`}>
                    {detail.fair_lending_required ? "ECOA Required" : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Champion Version</p>
                  <p className="font-mono font-medium">{detail.champion_version ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Challenger Version</p>
                  <p className="font-mono font-medium">{detail.challenger_version ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Governance Thresholds */}
          {Object.keys(detail.thresholds ?? {}).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Governance Thresholds
                </CardTitle>
                <CardDescription>
                  Minimum performance requirements — green = passing, red = failing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {Object.entries(detail.thresholds).map(([k, v]) => (
                    <MetricRow
                      key={k}
                      label={k.replace(/_/g, " ").toUpperCase()}
                      value={v}
                      threshold={v}
                      higherIsBetter={!k.includes("psi")}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section C: Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium">Version</th>
                      <th className="text-left p-2 font-medium">Stage</th>
                      <th className="text-left p-2 font-medium">Created</th>
                      <th className="text-left p-2 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.versions ?? []).map((v) => (
                      <tr key={v.version} className="border-b hover:bg-muted/10">
                        <td className="p-2 font-mono">
                          {v.version}
                          {v.version === detail.champion_version && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-1.5 py-0.5">
                              champion
                            </span>
                          )}
                          {v.version === detail.challenger_version && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-1.5 py-0.5">
                              challenger
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <StageBadge stage={v.stage} />
                        </td>
                        <td className="p-2 text-xs text-gray-600">
                          {formatDateTime(v.created_at)}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(v.tags ?? {}).map(([tk, tv]) => (
                              <span
                                key={tk}
                                className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 font-mono"
                              >
                                {tk}={tv}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(detail.versions ?? []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground">
                          No versions registered
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Section D: Validation Log */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Independent Validation Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {validations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No validation records found
                  </p>
                )}
                {validations.map((v) => (
                  <div key={v.id} className="border rounded-md overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 text-left transition-colors"
                      onClick={() =>
                        setExpandedValidation(
                          expandedValidation === v.id ? null : v.id
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        {v.outcome === "PASS" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : v.outcome === "FAIL" ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="font-medium text-sm">{formatDateTime(v.validated_at)}</span>
                        <span className="text-xs text-muted-foreground">
                          Validator: {v.validator_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            v.outcome === "PASS"
                              ? "bg-green-100 text-green-700"
                              : v.outcome === "FAIL"
                              ? "bg-red-100 text-red-600"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {v.outcome}
                        </span>
                        {expandedValidation === v.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                    {expandedValidation === v.id && (
                      <div className="px-4 py-3 bg-white border-t">
                        <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap bg-gray-50 rounded p-3 max-h-48">
                          {JSON.stringify(v.findings, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section E: Governance Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Governance Audit Trail
              </CardTitle>
              <CardDescription>
                Immutable SR 11-7 lifecycle decisions — most recent 20 records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium">Action</th>
                      <th className="text-left p-2 font-medium">New Stage</th>
                      <th className="text-left p-2 font-medium">Performed By</th>
                      <th className="text-left p-2 font-medium">Rationale</th>
                      <th className="text-left p-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-muted/10">
                        <td className="p-2 font-mono text-xs">{e.action}</td>
                        <td className="p-2">
                          {e.new_stage ? <StageBadge stage={e.new_stage} /> : "—"}
                        </td>
                        <td className="p-2 text-xs">{e.performed_by}</td>
                        <td className="p-2 text-xs text-gray-600 max-w-xs truncate">
                          {e.rationale}
                        </td>
                        <td className="p-2 text-xs text-gray-600">
                          {formatDateTime(e.created_at)}
                        </td>
                      </tr>
                    ))}
                    {auditLog.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          No audit records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Compliance
// ---------------------------------------------------------------------------

function ComplianceTab({
  adverseAction,
  models,
}: {
  adverseAction: AdverseActionNotice[];
  models: ModelSummary[];
}) {
  const [auditLog, setAuditLog] = useState<GovernanceAuditEntry[]>([]);
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [loadingAudit, setLoadingAudit] = useState(false);

  const fetchGlobalAudit = useCallback(async () => {
    if (filterModel === "all" || !filterModel) return;
    setLoadingAudit(true);
    try {
      const res = await fetch(
        `${API_BASE}/models/${filterModel}/audit?limit=100`
      );
      if (res.ok) {
        const d = await res.json();
        setAuditLog(d.items ?? d);
      }
    } finally {
      setLoadingAudit(false);
    }
  }, [filterModel]);

  useEffect(() => {
    fetchGlobalAudit();
  }, [fetchGlobalAudit]);

  const exportCSV = (data: AdverseActionNotice[]) => {
    const headers = [
      "id",
      "application_id",
      "model_name",
      "reason_codes",
      "status",
      "enqueued_at",
      "dispatch_deadline",
      "overdue",
    ];
    const rows = data.map((n) =>
      [
        n.id,
        n.application_id,
        n.model_name,
        n.reason_codes.join("|"),
        n.status,
        n.enqueued_at,
        n.dispatch_deadline,
        n.overdue,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adverse_action_queue.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditJson = () => {
    const blob = new Blob([JSON.stringify(filteredAudit, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `governance_audit_${filterModel}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAudit = auditLog.filter((e) => {
    if (filterAction && !e.action.toLowerCase().includes(filterAction.toLowerCase()))
      return false;
    if (filterDateFrom && e.created_at < filterDateFrom) return false;
    if (filterDateTo && e.created_at > filterDateTo + "T23:59:59") return false;
    return true;
  });

  // Compute fair lending scorecard from adverse action queue
  const fairLendingModels = models.filter((m) => m.fair_lending_required);

  return (
    <div className="space-y-6">
      {/* Section A: Adverse Action Notice Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Adverse Action Notice Queue
              </CardTitle>
              <CardDescription>
                FCRA/ECOA 30-day dispatch SLA — overdue rows highlighted in red
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(adverseAction)}
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-2 font-medium">Application ID</th>
                  <th className="text-left p-2 font-medium">Model</th>
                  <th className="text-left p-2 font-medium">Reason Codes</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Enqueued</th>
                  <th className="text-left p-2 font-medium">Dispatch Deadline</th>
                  <th className="text-left p-2 font-medium">SLA</th>
                </tr>
              </thead>
              <tbody>
                {adverseAction.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      No pending notices
                    </td>
                  </tr>
                )}
                {adverseAction.map((n) => (
                  <tr
                    key={n.id}
                    className={`border-b ${n.overdue ? "bg-red-50" : "hover:bg-muted/10"}`}
                  >
                    <td className="p-2 font-mono text-xs">{n.application_id}</td>
                    <td className="p-2 text-xs">
                      {MODEL_DISPLAY_NAMES[n.model_name] ?? n.model_name}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {n.reason_codes.map((rc) => (
                          <span
                            key={rc}
                            className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5 font-mono"
                          >
                            {rc}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2 text-xs font-medium">{n.status}</td>
                    <td className="p-2 text-xs text-gray-600">
                      {formatDate(n.enqueued_at)}
                    </td>
                    <td
                      className={`p-2 text-xs font-medium ${
                        n.overdue ? "text-red-600" : "text-gray-700"
                      }`}
                    >
                      {formatDate(n.dispatch_deadline)}
                      {n.overdue && " ⚠"}
                    </td>
                    <td className="p-2">
                      {n.overdue ? (
                        <span className="text-xs bg-red-100 text-red-700 font-semibold rounded-full px-2 py-0.5">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold rounded-full px-2 py-0.5">
                          ON TRACK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section B: Governance Approval Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Governance Approval Log
              </CardTitle>
              <CardDescription>
                Immutable SR 11-7 lifecycle records with 7-year retention
              </CardDescription>
            </div>
            {auditLog.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportAuditJson}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export JSON
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Model</p>
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {models.map((m) => (
                    <SelectItem key={m.model_name} value={m.model_name}>
                      {MODEL_DISPLAY_NAMES[m.model_name] ?? m.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Action filter</p>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. PROMOTE"
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">From date</p>
              <Input
                className="h-8 text-sm"
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">To date</p>
              <Input
                className="h-8 text-sm"
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
          </div>

          {filterModel === "all" ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Select a model above to view its governance log.
            </p>
          ) : loadingAudit ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading audit log…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-2 font-medium">Action</th>
                    <th className="text-left p-2 font-medium">New Stage</th>
                    <th className="text-left p-2 font-medium">Performed By</th>
                    <th className="text-left p-2 font-medium">Rationale</th>
                    <th className="text-left p-2 font-medium">Metrics</th>
                    <th className="text-left p-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-muted/10">
                      <td className="p-2 font-mono text-xs font-medium">{e.action}</td>
                      <td className="p-2">
                        {e.new_stage ? <StageBadge stage={e.new_stage} /> : "—"}
                      </td>
                      <td className="p-2 text-xs">{e.performed_by}</td>
                      <td className="p-2 text-xs text-gray-600 max-w-xs truncate">
                        {e.rationale}
                      </td>
                      <td className="p-2">
                        {e.metrics_snapshot && Object.keys(e.metrics_snapshot).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-xs text-blue-600">
                              {Object.keys(e.metrics_snapshot).length} metrics
                            </summary>
                            <pre className="text-xs mt-1 bg-gray-50 p-1 rounded max-w-xs overflow-auto">
                              {JSON.stringify(e.metrics_snapshot, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2 text-xs text-gray-600">
                        {formatDateTime(e.created_at)}
                      </td>
                    </tr>
                  ))}
                  {filteredAudit.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        No records match the current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Fair Lending Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Fair Lending Scorecard — ECOA / 4/5ths Rule
          </CardTitle>
          <CardDescription>
            Models requiring disparate impact analysis under ECOA / Reg B
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fairLendingModels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No models currently require fair lending review.
            </p>
          ) : (
            <div className="space-y-4">
              {fairLendingModels.map((m) => (
                <div
                  key={m.model_name}
                  className="flex items-center justify-between border rounded-lg p-4"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {MODEL_DISPLAY_NAMES[m.model_name] ?? m.model_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Owner: {m.model_owner_email} · Review cycle: {m.review_cycle_months}mo
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">ECOA Compliance</p>
                      <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-semibold">
                        REQUIRED
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">DI Threshold</p>
                      <p className="text-sm font-mono font-medium text-gray-700">≥ 0.80</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Status</p>
                      {m.governance_status === "PASS" ? (
                        <span className="flex items-center gap-1 text-green-700 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" /> COMPLIANT
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <Clock className="h-3.5 w-3.5" /> PENDING CHECK
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Disparity threshold: 4/5ths rule (DI ratio ≥ 0.80). Run{" "}
                <code className="bg-gray-100 rounded px-1">
                  mortgage_valuation_monitor.py --checks disparate_impact
                </code>{" "}
                for live DI ratio.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function ModelRegistryPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [adverseAction, setAdverseAction] = useState<AdverseActionNotice[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoadingModels(true);
    try {
      const [modelsRes, aaRes] = await Promise.all([
        fetch(`${API_BASE}/models`),
        fetch(`${API_BASE}/adverse-action/pending`),
      ]);
      if (modelsRes.ok) setModels(await modelsRes.json());
      if (aaRes.ok) setAdverseAction(await aaRes.json());
      setLastRefresh(new Date());
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSelectModel = (name: string) => {
    setSelectedModel(name);
    setActiveTab("detail");
  };

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Model Registry &amp; MRM Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            SR 11-7 Model Risk Management — All registered models across CC and Mortgage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loadingModels}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loadingModels ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" />
            Registry Overview
          </TabsTrigger>
          <TabsTrigger value="detail" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Model Detail
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <RegistryOverview
            models={models}
            adverseAction={adverseAction}
            onSelectModel={handleSelectModel}
            loading={loadingModels}
          />
        </TabsContent>

        <TabsContent value="detail" className="mt-6">
          <ModelDetailTab
            models={models}
            selectedModelName={selectedModel}
            onSelectModel={setSelectedModel}
          />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceTab adverseAction={adverseAction} models={models} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ModelRegistryPage);
