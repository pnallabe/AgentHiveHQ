"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plug,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiClient, ApiError } from "@/lib/api";
import type { ProductSummary, NormalisedResponse, InvokeRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Health badge
// ---------------------------------------------------------------------------

const HEALTH_CONFIG = {
  healthy:  { label: "Healthy",  icon: CheckCircle2, cls: "bg-emerald-950 text-emerald-400 border-emerald-700/30" },
  degraded: { label: "Degraded", icon: AlertTriangle, cls: "bg-amber-950 text-amber-400 border-amber-700/30" },
  down:     { label: "Down",     icon: XCircle,       cls: "bg-red-950 text-red-400 border-red-700/30" },
  unknown:  { label: "Unknown",  icon: Clock,         cls: "bg-zinc-900 text-zinc-500 border-zinc-700/30" },
} as const;

function HealthBadge({ status }: { status: ProductSummary["health_status"] }) {
  const cfg = HEALTH_CONFIG[status] ?? HEALTH_CONFIG.unknown;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.cls
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Decision badge
// ---------------------------------------------------------------------------

const DECISION_COLORS: Record<string, string> = {
  approve: "bg-emerald-950 text-emerald-400 border-emerald-700/30",
  reject:  "bg-red-950 text-red-400 border-red-700/30",
  review:  "bg-amber-950 text-amber-400 border-amber-700/30",
};

function DecisionBadge({ decision }: { decision: string }) {
  const cls = DECISION_COLORS[decision.toLowerCase()] ?? "bg-zinc-900 text-zinc-300 border-zinc-700";
  return (
    <span className={cn("inline-block rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wider", cls)}>
      {decision}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

function ProductCard({
  product,
  onSelect,
  selected,
}: {
  product: ProductSummary;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-primary bg-primary/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-zinc-100 text-sm">{product.display_name}</p>
            <HealthBadge status={product.health_status} />
          </div>
          <p className="mt-1 text-xs text-zinc-500 leading-relaxed line-clamp-2">{product.description}</p>
          <p className="mt-1.5 font-mono text-xs text-zinc-600">{product.product_id}</p>
        </div>
        {selected ? (
          <ChevronDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dynamic input form (key-value fields from inputs JSON)
// ---------------------------------------------------------------------------

function DynamicInputForm({
  product,
  onInvoke,
  isLoading,
  schema,
}: {
  product: ProductSummary;
  onInvoke: (req: InvokeRequest) => void;
  isLoading: boolean;
  schema?: Record<string, unknown> | null;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [demoMode, setDemoMode] = useState(product.demo_mode_supported);
  const [scenarioTag, setScenarioTag] = useState(product.demo_scenarios[0]?.tag ?? "");
  const [rawInputs, setRawInputs] = useState("{}");
  const [useRaw, setUseRaw] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsedInputs: Record<string, unknown>;
    if (!useRaw && schema?.properties) {
      // Build payload from typed schema fields
      parsedInputs = Object.fromEntries(
        Object.entries(inputs).map(([k, v]) => [k, v])
      );
      setJsonError(null);
    } else {
      try {
        parsedInputs = JSON.parse(rawInputs);
        setJsonError(null);
      } catch {
        setJsonError("Invalid JSON — please check your input and try again.");
        return;
      }
    }
    onInvoke({
      inputs: parsedInputs as Record<string, unknown>,
      demo_mode: demoMode,
      scenario_tag: demoMode && scenarioTag ? scenarioTag : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Demo mode toggle */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="mr-2 accent-primary"
            disabled={!product.demo_mode_supported}
          />
          Demo Mode
        </label>
        {!product.demo_mode_supported && (
          <span className="text-xs text-zinc-600">(not supported by this product)</span>
        )}
      </div>

      {/* Scenario selector */}
      {demoMode && product.demo_scenarios.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Scenario</label>
          <select
            value={scenarioTag}
            onChange={(e) => setScenarioTag(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {product.demo_scenarios.map((s) => (
              <option key={s.tag} value={s.tag}>
                {s.label}{s.description ? ` — ${s.description}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Input mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setUseRaw(false)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-md border transition-colors",
            !useRaw ? "border-primary text-primary" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
          )}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setUseRaw(true)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-md border transition-colors",
            useRaw ? "border-primary text-primary" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
          )}
        >
          Raw JSON
        </button>
      </div>

      {/* JSON inputs editor */}
      {useRaw ? (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">
            Inputs (JSON)
          </label>
          <textarea
            rows={8}
            value={rawInputs}
            onChange={(e) => setRawInputs(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder='{"income": 45000, "employment_months": 18}'
            spellCheck={false}
          />
        </div>
      ) : schema?.properties ? (
        // Render labelled form fields generated from the upstream OpenAPI schema
        <div className="space-y-3">
          {Object.entries(schema.properties as Record<string, Record<string, unknown>>).map(
            ([fieldName, fieldSchema]) => (
              <div key={fieldName}>
                <label className="block text-xs text-zinc-400 mb-1">
                  <span className="font-medium">{fieldName}</span>
                  {fieldSchema.type && (
                    <span className="ml-1.5 font-mono text-zinc-600">
                      ({String(fieldSchema.type)})
                    </span>
                  )}
                  {fieldSchema.description && (
                    <span className="ml-1 text-zinc-600">
                      — {String(fieldSchema.description)}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={inputs[fieldName] ?? ""}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [fieldName]: e.target.value }))
                  }
                  placeholder={String(fieldSchema.example ?? fieldSchema.default ?? "")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500 mb-2">
            Use <strong className="text-zinc-400">Raw JSON</strong> tab to enter custom inputs, or enable Demo Mode to use a preset scenario.
          </p>
          <p className="text-xs font-mono text-zinc-600">inputs: {"{}"} (empty → service uses demo defaults)</p>
        </div>
      )}

      {jsonError && (
        <p className="text-xs text-red-400" role="alert">{jsonError}</p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Invoking…
          </>
        ) : (
          <>
            <Plug className="mr-2 h-4 w-4" />
            Run External Decision
          </>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------

function ResultPanel({ result }: { result: NormalisedResponse }) {
  const { toast } = useToast();
  const [showRaw, setShowRaw] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.decision_id);
      toast({ description: "Decision ID copied" });
    } catch {
      toast({ description: "Copy failed", variant: "destructive" });
    }
  };

  const hasExtra = Object.keys(result.raw_extra ?? {}).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Decision headline */}
      <div className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <DecisionBadge decision={result.decision} />
          <button
            onClick={copy}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-300 transition-colors font-mono"
            title="Copy decision ID"
          >
            <Copy className="h-3 w-3" />
            {result.decision_id.slice(0, 8)}…
          </button>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed">{result.summary}</p>
        <div className="flex gap-4 text-xs text-zinc-500 font-mono">
          <span>{result.audit?.model_version}</span>
          <span>{result.audit?.latency_ms != null ? `${Math.round(result.audit.latency_ms)}ms` : ""}</span>
          <span className="text-zinc-600">source: {result.source}</span>
        </div>
      </div>

      {/* Details */}
      {Object.keys(result.details ?? {}).length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Details</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(result.details).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-zinc-600">{k}</dt>
                <dd className="font-mono text-xs text-zinc-200">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Reason codes */}
      {result.reason_codes?.length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Reason Codes</p>
          <div className="flex flex-wrap gap-2">
            {result.reason_codes.map((code) => (
              <span
                key={code}
                className="inline-block rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanations (SHAP-like) */}
      {Object.keys(result.explanations ?? {}).length > 0 && (
        <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Feature Contributions</p>
          <dl className="space-y-1.5">
            {Object.entries(result.explanations).map(([k, v]) => {
              const val = Number(v);
              const isPos = val >= 0;
              return (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-zinc-400 flex-1 min-w-0 truncate">{k}</dt>
                  <dd className={cn("font-mono text-xs font-semibold", isPos ? "text-emerald-400" : "text-red-400")}>
                    {isPos ? "+" : ""}{val.toFixed(3)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Raw extra */}
      {hasExtra && (
        <div className="rounded-xl border border-surface-border bg-surface-raised">
          <button
            onClick={() => setShowRaw((p) => !p)}
            className="flex w-full items-center justify-between p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
          >
            <span>Raw Extra Fields</span>
            {showRaw ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <AnimatePresence>
            {showRaw && (
              <motion.pre
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-auto px-4 pb-4 font-mono text-xs text-zinc-400"
              >
                {JSON.stringify(result.raw_extra, null, 2)}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Error card
// ---------------------------------------------------------------------------

function ErrorCard({ error }: { error: ApiError }) {
  return (
    <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-4 space-y-1">
      <p className="font-semibold text-red-400 text-sm">{error.title}</p>
      <p className="text-sm text-red-300/80">{error.detail}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IntegrationsLabPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [invoking, setInvoking] = useState(false);
  const [result, setResult] = useState<NormalisedResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await apiClient.integrations.list();
      setProducts(list);
      // Prompt 15 — if the previously selected product no longer exists in the
      // refreshed list, reset selection so we don’t show a stale invoke panel.
      const stillExists = list.some((p) => p.product_id === selectedId);
      if (!stillExists) {
        setSelectedId(list.length > 0 ? list[0].product_id : null);
        setResult(null);
        setError(null);
      } else if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].product_id);
      }
    } catch (err) {
      toast({ description: "Failed to load integrations", variant: "destructive" });
      setListError((err as Error).message ?? "Failed to load integrations.");
    } finally {
      setLoadingList(false);
    }
  }, [selectedId, toast]);

  useEffect(() => {
    loadProducts();
  }, []);

  // Fetch the upstream OpenAPI schema whenever the selected product changes.
  useEffect(() => {
    if (!selectedId) { setSchema(null); return; }
    setSchemaLoading(true);
    setSchema(null);
    apiClient.integrations.schema(selectedId)
      .then((s) => setSchema(s))
      .catch(() => setSchema(null))
      .finally(() => setSchemaLoading(false));
  }, [selectedId]);

  const selectedProduct = products.find((p) => p.product_id === selectedId) ?? null;

  const handleInvoke = async (req: InvokeRequest) => {
    if (!selectedId) return;
    setInvoking(true);
    setResult(null);
    setError(null);
    try {
      const res = await apiClient.integrations.invoke(selectedId, req);
      setResult(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(ApiError.fromStatus(0, "Unknown error"));
      }
    } finally {
      setInvoking(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Integration Gateway
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">
            Live external AI products connected via the AgentHive secure proxy.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadProducts}
          disabled={loadingList}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loadingList && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Inline error banner — shown when the product list fails to load */}
      {listError && (
        <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-4 text-sm text-reject-base">
          {listError}
        </div>
      )}

      {/* Stats bar */}
      {!loadingList && products.length > 0 && (
        <div className="flex gap-6 text-xs text-zinc-500 font-mono border-b border-zinc-800 pb-4">
          <span>
            <Activity className="inline h-3.5 w-3.5 mr-1 text-emerald-500" />
            {products.filter((p) => p.health_status === "healthy").length} healthy
          </span>
          <span>{products.filter((p) => p.health_status === "degraded").length} degraded</span>
          <span>{products.filter((p) => p.health_status === "down").length} down</span>
          <span>{products.length} total</span>
        </div>
      )}

      {loadingList ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
          <Plug className="mx-auto h-10 w-10 text-zinc-700 mb-3" />
          <p className="font-medium text-zinc-400">No integrations registered</p>
          <p className="mt-1 text-sm text-zinc-600">
            Add a YAML manifest to{" "}
            <code className="font-mono text-xs text-zinc-500">backend/integrations/registry/</code>{" "}
            and restart the server.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Product list */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Registered Products
            </p>
            {products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                selected={product.product_id === selectedId}
                onSelect={() => {
                  setSelectedId(product.product_id);
                  setResult(null);
                  setError(null);
                }}
              />
            ))}
          </div>

          {/* Invoke panel */}
          <div className="lg:col-span-3 space-y-4">
            {selectedProduct ? (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-zinc-100">{selectedProduct.display_name}</p>
                    <HealthBadge status={selectedProduct.health_status} />
                  </div>
                  <p className="text-xs text-zinc-500">{selectedProduct.description}</p>
                </div>

                <DynamicInputForm
                  product={selectedProduct}
                  onInvoke={handleInvoke}
                  isLoading={invoking}
                  schema={schemaLoading ? null : schema}
                />

                {error && <ErrorCard error={error} />}
                {result && <ResultPanel result={result} />}
              </>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-sm">
                Select a product to get started
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
