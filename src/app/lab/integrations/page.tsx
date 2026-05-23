"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Send,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiClient, ApiError } from "@/lib/api";
import type { ProductSummary, NormalisedResponse, InvokeRequest, ClarificationItem } from "@/lib/types";
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.cls)}>
      <Icon className="h-3 w-3" aria-hidden />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Decision badge
// ---------------------------------------------------------------------------

const DECISION_COLORS: Record<string, string> = {
  approve:               "bg-emerald-950 text-emerald-400 border-emerald-700/30",
  reject:                "bg-red-950 text-red-400 border-red-700/30",
  review:                "bg-amber-950 text-amber-400 border-amber-700/30",
  analyst_response:      "bg-blue-950 text-blue-300 border-blue-700/30",
  clarification_needed:  "bg-violet-950 text-violet-300 border-violet-700/30",
};

function DecisionBadge({ decision }: { decision: string }) {
  const key = decision.toLowerCase();
  const cls = DECISION_COLORS[key] ?? "bg-zinc-900 text-zinc-300 border-zinc-700";
  const label =
    key === "analyst_response"     ? "Analyst Response" :
    key === "clarification_needed" ? "Clarification Needed" :
    decision;
  return (
    <span className={cn("inline-block rounded-full border px-3 py-0.5 text-xs font-semibold uppercase tracking-wider", cls)}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Product card (left panel)
// ---------------------------------------------------------------------------

function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: ProductSummary;
  selected: boolean;
  onSelect: () => void;
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
// Chat message types
// ---------------------------------------------------------------------------

type UserMessage      = { role: "user";      text: string;              id: string };
type AssistantMessage = { role: "assistant"; result: NormalisedResponse; id: string };
type ErrorMessage     = { role: "error";     text: string;              id: string };
type ChatMessage      = UserMessage | AssistantMessage | ErrorMessage;

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex gap-1.5 items-center px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant bubble
// ---------------------------------------------------------------------------

function AssistantBubble({
  result,
  onOptionSelect,
}: {
  result: NormalisedResponse;
  onOptionSelect?: (option: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const isClarification = result.needs_clarification === true;
  const clarificationItems: ClarificationItem[] = result.clarification_items ?? [];

  const hasReasonCodes  = (result.reason_codes ?? []).length > 0;
  const hasExplanations = Object.keys(result.explanations ?? {}).length > 0;
  const hasDetails      = Object.keys(result.details ?? {}).length > 0;
  const hasMore         = !isClarification && (hasReasonCodes || hasExplanations || hasDetails);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.decision_id);
      toast({ description: "Decision ID copied" });
    } catch { /* ignore */ }
  };

  return (
    <div className="flex gap-3">
      <div className={cn(
        "h-8 w-8 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
        isClarification
          ? "bg-violet-950/50 border-violet-700/30"
          : "bg-primary/10 border-primary/30"
      )}>
        <Sparkles className={cn("h-3.5 w-3.5", isClarification ? "text-violet-400" : "text-primary")} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <DecisionBadge decision={result.decision} />
          <button
            onClick={copy}
            className="flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Copy decision ID"
          >
            <Copy className="h-3 w-3" />
            {result.decision_id.slice(0, 8)}…
          </button>
          {result.audit?.latency_ms != null && (
            <span className="ml-auto font-mono text-xs text-zinc-600">
              {Math.round(result.audit.latency_ms)}ms
            </span>
          )}
        </div>

        <p className="text-sm text-zinc-200 leading-relaxed">{result.summary}</p>

        {/* Clarification option chips — one group per clarification item */}
        {isClarification && clarificationItems.length > 0 && onOptionSelect && (
          <div className="space-y-3 pt-1">
            {clarificationItems.map((item) => (
              <div key={item.id}>
                <p className="text-xs text-zinc-500 mb-1.5">{item.question}</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onOptionSelect(opt)}
                      className="rounded-full border border-violet-700/40 bg-violet-950/30 px-3 py-1 text-xs text-violet-300 hover:bg-violet-900/50 hover:border-violet-500 transition-all"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <div>
            <button
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide" : "Show"} details
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-3 space-y-4"
                >
                  {hasReasonCodes && (
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Reason Codes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.reason_codes.map((code) => (
                          <span key={code} className="rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 font-mono text-xs text-zinc-300">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasExplanations && (
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Feature Contributions</p>
                      <div className="space-y-1.5">
                        {Object.entries(result.explanations).map(([k, v]) => {
                          const val = Number(v);
                          const isPos = val >= 0;
                          return (
                            <div key={k} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-zinc-400 truncate">{k}</span>
                              <span className={cn("font-mono font-semibold shrink-0", isPos ? "text-emerald-400" : "text-red-400")}>
                                {isPos ? "+" : ""}{val.toFixed(3)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hasDetails && (
                    <div>
                      <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2">Details</p>
                      <pre className="text-xs text-zinc-400 font-mono bg-zinc-900 rounded-lg p-3 overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <p className="text-xs text-zinc-700 font-mono">{result.audit?.model_version}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending-clarification context
// Tracks the original query + which clarification items still need answers.
// ---------------------------------------------------------------------------

interface PendingClarification {
  originalQuery: string;
  items: ClarificationItem[];
  answers: Record<string, string>;   // id → answer collected so far
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

function ChatPanel({ product, productId }: { product: ProductSummary; productId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  // Tracks an in-progress clarification round-trip
  const [pending, setPending]   = useState<PendingClarification | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setMessages([]);
    setInput("");
    setPending(null);
  }, [productId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /**
   * Core send function.
   * When `clarifications` is provided the request carries the original query
   * together with the answers dict — the analytics API resolves all ambiguity
   * and returns real data on this turn.
   */
  const send = useCallback(
    async (
      text: string,
      demoScenario?: string,
      clarifications?: Record<string, string>,
      originalQuery?: string,
    ) => {
      const userText = text.trim();
      if (!userText && !demoScenario) return;

      const displayText = demoScenario
        ? (product.demo_scenarios.find((s) => s.tag === demoScenario)?.label ?? demoScenario)
        : userText;

      setMessages((prev) => [...prev, { role: "user", text: displayText, id: crypto.randomUUID() }]);
      setInput("");
      setLoading(true);

      // Build the effective query: when resolving a clarification, use the
      // original question so the analytics API sees the full intent.
      const effectiveQuery = originalQuery ?? userText;

      const req: InvokeRequest = demoScenario
        ? { inputs: { session_type: "analyst" }, demo_mode: true, scenario_tag: demoScenario }
        : {
            inputs: {
              session_type: "analyst",
              query: effectiveQuery,
              ...(clarifications && Object.keys(clarifications).length > 0 && { clarifications }),
            },
            demo_mode: false,
          };

      try {
        const result = await apiClient.integrations.invoke(productId, req);

        if (result.needs_clarification && (result.clarification_items?.length ?? 0) > 0) {
          const items = result.clarification_items!;
          const existingAnswers = clarifications ?? {};

          // Determine which items still lack answers
          const unanswered = items.filter((item) => !existingAnswers[item.id]);

          if (unanswered.length > 0) {
            // More questions to answer — keep pending state
            setPending({
              originalQuery: effectiveQuery,
              items,
              answers: existingAnswers,
            });
          } else {
            // All questions answered but API still returned clarification_needed
            // (shouldn't normally happen) — clear pending
            setPending(null);
          }
        } else {
          // Got a real answer — clear any pending clarification state
          setPending(null);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", result, id: crypto.randomUUID() } as AssistantMessage,
        ]);
      } catch (err) {
        const apiErr = err instanceof ApiError ? err : ApiError.fromStatus(0, "Unknown error");
        setMessages((prev) => [
          ...prev,
          { role: "error", text: apiErr.detail ?? apiErr.title, id: crypto.randomUUID() } as ErrorMessage,
        ]);
        toast({ description: apiErr.title, variant: "destructive" });
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [productId, product.demo_scenarios, toast]
  );

  /**
   * Called when the user clicks a clarification option chip or types a reply.
   * Maps the user's answer to the next unanswered clarification item id.
   * If all items now have answers, fires the resolved API call.
   * If more items still need answers, shows the next question.
   */
  const handleClarificationAnswer = useCallback(
    (answer: string) => {
      if (!pending) return;

      // Find the first unanswered item
      const nextItem = pending.items.find((item) => !pending.answers[item.id]);
      if (!nextItem) return;

      const updatedAnswers = { ...pending.answers, [nextItem.id]: answer };
      const remainingItems = pending.items.filter((item) => !updatedAnswers[item.id]);

      if (remainingItems.length === 0) {
        // All questions answered — fire the resolved request
        setPending(null);
        send(answer, undefined, updatedAnswers, pending.originalQuery);
      } else {
        // Still more items to answer — update answers and keep pending
        setPending((p) => p ? { ...p, answers: updatedAnswers } : null);
        // Fire an intermediate send that returns the next clarification question
        send(answer, undefined, updatedAnswers, pending.originalQuery);
      }
    },
    [pending, send]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault();
      if (pending) {
        handleClarificationAnswer(input);
      } else {
        send(input);
      }
    }
  };

  const handleSendClick = () => {
    if (pending) {
      handleClarificationAnswer(input);
    } else {
      send(input);
    }
  };

  const isEmpty = messages.length === 0;

  // Determine if the last assistant message is a clarification
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant") as AssistantMessage | undefined;
  const awaitingClarification = lastAssistant?.result.needs_clarification === true && pending != null;

  // The next unanswered clarification item (to show in placeholder)
  const nextPendingItem = pending?.items.find((item) => !pending.answers[item.id]);

  return (
    <div
      className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950"
      style={{ height: "calc(100vh - 260px)", minHeight: 500 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Plug className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-zinc-100 text-sm truncate">{product.display_name}</span>
          <HealthBadge status={product.health_status} />
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setPending(null); }}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 ml-2"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 max-w-sm mx-auto text-center">
            <div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-zinc-300">{product.display_name}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{product.description}</p>
            </div>

            {product.demo_scenarios.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-xs text-zinc-600 uppercase tracking-wider">Try a demo scenario</p>
                {product.demo_scenarios.map((s) => (
                  <button
                    key={s.tag}
                    onClick={() => send("", s.tag)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-left transition-all hover:border-primary/50 hover:bg-zinc-800"
                  >
                    <p className="text-sm font-medium text-zinc-200">{s.label}</p>
                    {s.description && <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-zinc-600">Or type any question below to send a live query.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/20 px-4 py-2.5">
                      <p className="text-sm text-zinc-200">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              if (msg.role === "error") {
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-red-950 border border-red-800/50 flex items-center justify-center shrink-0 mt-0.5">
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <div className="flex-1 rounded-xl border border-red-800/30 bg-red-950/30 px-4 py-2.5">
                      <p className="text-sm text-red-300">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              const assistantMsg = msg as AssistantMessage;
              // Only the most recent clarification message gets interactive chips
              const isLastMsg = assistantMsg.id === lastAssistant?.id;
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  <AssistantBubble
                    result={assistantMsg.result}
                    onOptionSelect={isLastMsg && awaitingClarification ? handleClarificationAnswer : undefined}
                  />
                </motion.div>
              );
            })}

            {loading && (
              <div className="flex gap-3 items-center">
                <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <TypingIndicator />
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Clarification context banner — shows which question we're answering */}
      {awaitingClarification && nextPendingItem && (
        <div className="border-t border-violet-700/20 bg-violet-950/20 px-4 py-2 text-xs text-violet-400 shrink-0">
          <span className="font-medium">Answering:</span> {nextPendingItem.question}
          {Object.keys(pending!.answers).length > 0 && (
            <span className="text-violet-600 ml-2">
              ({Object.keys(pending!.answers).length}/{pending!.items.length} answered)
            </span>
          )}
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-zinc-800 p-3 shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              awaitingClarification && nextPendingItem
                ? `Reply or pick an option above — ${nextPendingItem.question}`
                : "Ask a question about credit decisions or portfolio analytics…"
            }
            disabled={loading}
            className={cn(
              "flex-1 rounded-lg border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 disabled:opacity-50",
              awaitingClarification
                ? "border-violet-700/50 focus:ring-violet-500"
                : "border-zinc-700 focus:ring-primary"
            )}
          />
          <Button
            size="sm"
            onClick={handleSendClick}
            disabled={loading || !input.trim()}
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-zinc-700 mt-1.5 px-1">
          {awaitingClarification
            ? "Click an option above or type your answer and press Enter"
            : "Press Enter to send · Click a scenario above for a demo response"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IntegrationsLabPage() {
  const [products, setProducts]     = useState<ProductSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError]   = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const list = await apiClient.integrations.list();
      setProducts(list);
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.product_id === prev)) return prev;
        return list.length > 0 ? list[0].product_id : null;
      });
    } catch (err) {
      toast({ description: "Failed to load integrations", variant: "destructive" });
      setListError((err as Error).message ?? "Failed to load integrations.");
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = products.find((p) => p.product_id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            Integration Gateway
          </h1>
          <p className="mt-1 text-zinc-400 text-sm">
            Chat with external AI products connected via the AgentHive secure proxy.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProducts} disabled={loadingList} className="shrink-0">
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loadingList && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {listError && (
        <div className="rounded-lg border border-red-800/30 bg-red-950/30 p-4 text-sm text-red-400">
          {listError}
        </div>
      )}

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
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl bg-zinc-800" />)}
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-[500px] w-full rounded-xl bg-zinc-800" />
          </div>
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
          <div className="lg:col-span-2 space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Registered Products
            </p>
            {products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                selected={product.product_id === selectedId}
                onSelect={() => setSelectedId(product.product_id)}
              />
            ))}
          </div>

          <div className="lg:col-span-3">
            {selectedProduct ? (
              <ChatPanel product={selectedProduct} productId={selectedProduct.product_id} />
            ) : (
              <div className="flex h-[500px] items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-sm">
                Select a product to start chatting
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
