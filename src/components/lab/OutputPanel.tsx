"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Copy, FileQuestion } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DecisionBadge } from "@/components/shared/DecisionBadge";
import { cn } from "@/lib/utils";
import type { UnderwritingResponse, Decision } from "@/lib/types";
import type { ApiError } from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Plain-English explanations for common reason codes */
const REASON_CODE_LABELS: Record<string, string> = {
  INCOME_BELOW_MINIMUM: "Annual income is below the minimum threshold of $18,000.",
  INVALID_EMPLOYMENT_DATA: "Employment length data is invalid or negative.",
  CREDIT_SCORE_TOO_LOW: "Credit score is below the minimum acceptable threshold.",
  THIN_FILE_LOW_INCOME:
    "No credit history on file combined with income below $40,000 requires manual review.",
  THIN_FILE_COMPENSATED_BY_INCOME:
    "No prior credit history, but income level partially compensates for this risk.",
};

const DECISION_ICON: Record<Decision, React.ElementType> = {
  approve: CheckCircle2,
  reject: XCircle,
  review: Clock,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-surface-border bg-surface-raised/40 p-8 text-center">
      <FileQuestion className="h-10 w-10 text-zinc-700" aria-hidden />
      <div>
        <p className="font-medium text-zinc-400">No decision yet</p>
        <p className="mt-1 text-sm text-zinc-600">
          Fill in the applicant profile and click{" "}
          <span className="font-medium text-zinc-500">Run Decision</span> to see results here.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading decision" aria-busy="true">
      <Skeleton className="h-24 w-full rounded-xl bg-surface-raised" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-20 rounded-xl bg-surface-raised" />
        <Skeleton className="h-20 rounded-xl bg-surface-raised" />
        <Skeleton className="h-20 rounded-xl bg-surface-raised" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl bg-surface-raised" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full bg-surface-raised" />
        <Skeleton className="h-7 w-36 rounded-full bg-surface-raised" />
      </div>
    </div>
  );
}

function ErrorCard({ error }: { error: ApiError }) {
  return (
    <div className="rounded-xl border border-reject-base/30 bg-reject-muted p-4 space-y-1.5">
      <p className="font-semibold text-reject-base text-sm">{error.title}</p>
      <p className="text-sm text-red-300/80">{error.detail}</p>
      {error.instance && (
        <p className="text-xs font-mono text-red-400/50">{error.instance}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terms card
// ---------------------------------------------------------------------------

function TermCard({
  label,
  value,
  dimmed,
}: {
  label: string;
  value: string;
  dimmed: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-surface-border bg-surface-raised p-3 text-center transition-opacity",
        dimmed && "opacity-40"
      )}
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result state
// ---------------------------------------------------------------------------
// SVG Confidence Arc
// ---------------------------------------------------------------------------

const ARC_R = 40;
const ARC_CIRC = 2 * Math.PI * ARC_R; // ≈ 251.3

const DECISION_ARC_COLOR: Record<Decision, string> = {
  approve: "#22c55e",
  reject:  "#ef4444",
  review:  "#f59e0b",
};

function ConfidenceArc({ score, decision }: { score: number; decision: Decision }) {
  const pct = Math.min(Math.max(score, 0), 1);
  const dash = pct * ARC_CIRC;
  const color = DECISION_ARC_COLOR[decision];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width={100} height={100} viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
        {/* Track */}
        <circle cx={50} cy={50} r={ARC_R} fill="none" stroke="#27272a" strokeWidth={8} />
        {/* Animated fill */}
        <motion.circle
          cx={50} cy={50} r={ARC_R}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={ARC_CIRC}
          initial={{ strokeDashoffset: ARC_CIRC }}
          animate={{ strokeDashoffset: ARC_CIRC - dash }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </svg>
      {/* Percentage label */}
      <span className="absolute font-mono text-sm font-semibold tabular-nums text-zinc-100">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card — framer motion scaleIn
// ---------------------------------------------------------------------------

const DECISION_BORDER_LINE: Record<Decision, string> = {
  approve: "border-l-approve-base",
  reject:  "border-l-reject-base",
  review:  "border-l-amber-400",
};

const DECISION_ICON_CL: Record<Decision, string> = {
  approve: "text-approve-base",
  reject:  "text-reject-base",
  review:  "text-amber-400",
};

function ResultCard({
  result,
  elapsedMs,
}: {
  result: UnderwritingResponse;
  elapsedMs: number | null;
}) {
  const { toast } = useToast();
  const Icon = DECISION_ICON[result.decision];
  const isRejected = result.decision === "reject";

  const copyDecisionId = async () => {
    try {
      await navigator.clipboard.writeText(result.decision_id);
      toast({ description: "Decision ID copied" });
    } catch {
      toast({ description: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Decision hero */}
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border border-surface-border border-l-4 bg-surface-raised p-4",
          DECISION_BORDER_LINE[result.decision]
        )}
      >
        <Icon
          className={cn("h-8 w-8 shrink-0", DECISION_ICON_CL[result.decision])}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <DecisionBadge decision={result.decision} className="mb-1" />
          <p className="text-xl font-bold text-zinc-50 capitalize">
            {result.decision === "approve"
              ? "Application Approved"
              : result.decision === "reject"
              ? "Application Rejected"
              : "Sent for Review"}
          </p>
        </div>

        {/* SVG Confidence Arc */}
        <ConfidenceArc score={result.confidence_score} decision={result.decision} />
      </div>

      {/* Terms row */}
      <div className="grid grid-cols-3 gap-3">
        <TermCard
          label="Credit Limit"
          value={`$${result.credit_limit.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
          dimmed={isRejected}
        />
        <TermCard
          label="APR"
          value={`${result.apr.toFixed(2)}%`}
          dimmed={isRejected}
        />
        <TermCard
          label="Risk Segment"
          value={result.risk_segment.replace("_", " ")}
          dimmed={false}
        />
      </div>

      {/* Reason codes */}
      {result.reason_codes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Reason Codes
          </p>
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap gap-2">
              {result.reason_codes.map((code) => (
                <Tooltip key={code}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="cursor-help border-surface-border bg-surface-base font-mono text-xs text-zinc-400 hover:bg-surface-overlay"
                    >
                      {code}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="max-w-xs border-surface-border bg-surface-overlay text-zinc-200"
                  >
                    {REASON_CODE_LABELS[code] ?? code}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Decision ID + elapsed */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-surface-border bg-surface-base px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[10px] text-zinc-600">ID</span>
          <span className="truncate font-mono text-xs tabular-nums text-zinc-400">
            {result.decision_id}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {elapsedMs !== null && (
            <span className="font-mono text-[10px] tabular-nums text-zinc-600">
              {elapsedMs}ms
            </span>
          )}
          <button
            onClick={copyDecisionId}
            className="rounded p-1 text-zinc-600 transition-colors hover:bg-surface-overlay hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Copy decision ID"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main OutputPanel
// ---------------------------------------------------------------------------

type OutputState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "result"; result: UnderwritingResponse; elapsedMs: number | null };

interface OutputPanelProps {
  state: OutputState;
  className?: string;
}

export function OutputPanel({ state, className }: OutputPanelProps) {
  return (
    <div
      className={cn("min-h-64", className)}
      aria-live="polite"
      aria-atomic="true"
    >
      {state.status === "idle" && <EmptyState />}
      {state.status === "loading" && <LoadingState />}
      {state.status === "error" && <ErrorCard error={state.error} />}
      {state.status === "result" && (
        <ResultCard result={state.result} elapsedMs={state.elapsedMs} />
      )}
    </div>
  );
}

export type { OutputState };
