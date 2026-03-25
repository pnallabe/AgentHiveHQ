"use client";

/**
 * AuditPanel — Terminal-aesthetic audit trail for a credit decision.
 * Sprint 8.6: bg-surface-base mono grid, hash 16-char tooltip, framer collapse.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Copy, CheckCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { DecisionAudit } from "@/lib/types";

interface AuditPanelProps {
  audit: DecisionAudit;
  decisionId: string;
  elapsedMs?: number;
}

// ---------------------------------------------------------------------------
// Row — monospace grid k/v line
// ---------------------------------------------------------------------------

function Row({
  k,
  v,
  color,
  tooltip,
}: {
  k: string;
  v: React.ReactNode;
  color?: "amber" | "green" | "red" | "muted";
  tooltip?: string;
}) {
  const valueColor =
    color === "amber" ? "text-amber-400"   :
    color === "green" ? "text-emerald-400" :
    color === "red"   ? "text-red-400"     :
    color === "muted" ? "text-zinc-600"    :
    "text-zinc-300";

  const valueEl = (
    <span className={`font-mono text-xs tabular-nums ${valueColor}`}>{v}</span>
  );

  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 border-b border-zinc-800/60 py-1.5 last:border-0">
      <span className="font-mono text-xs text-zinc-600">{k}</span>
      {tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{valueEl}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs font-mono text-xs break-all">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        valueEl
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditPanel({ audit, decisionId, elapsedMs }: AuditPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const fullHash  = audit.model_artifact_hash ?? audit.model_version ?? "";
  const shortHash = fullHash.slice(0, 16);
  const shortId   = decisionId.slice(0, 8);

  const shortTs = audit.timestamp
    ? new Date(audit.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      })
    : "—";

  const auditObj = {
    decision_id:      decisionId,
    timestamp:        audit.timestamp,
    model_version:    audit.model_version,
    artifact_hash:    fullHash,
    rules_evaluated:  audit.rules_evaluated ?? 4,
    rules_triggered:  audit.rules_triggered ?? [],
    rules_overridden: audit.rules_overridden ?? false,
    demo_mode:        audit.demo_mode ?? false,
    elapsed_ms:       elapsedMs ?? null,
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(auditObj, null, 2));
    setCopied(true);
    toast({ title: "Audit JSON copied" });
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-base">
      {/* Terminal title bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {/* Traffic-light dots */}
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
        </span>

        <ShieldCheck className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
        <span className="font-mono text-xs text-zinc-500">audit_trail</span>

        <div className="ml-auto flex items-center gap-2">
          {!open && (
            <>
              <Badge variant="outline" className="border-zinc-800 bg-transparent font-mono text-[10px] text-zinc-500">
                {shortHash}…
              </Badge>
              <Badge variant="outline" className="border-zinc-800 bg-transparent font-mono text-[10px] text-zinc-500">
                {shortTs}
              </Badge>
              {audit.demo_mode && (
                <Badge className="bg-amber-500/10 text-[10px] text-amber-400 ring-1 ring-amber-600/30">
                  demo
                </Badge>
              )}
            </>
          )}
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
          )}
        </div>
      </button>

      {/* Animated expanded content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="audit-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-border px-4 py-3">
              <Row k="decision_id"     v={shortId + "…"} tooltip={decisionId} />
              <Row k="timestamp"       v={audit.timestamp ?? "—"} />
              <Row k="model_version"   v={audit.model_version ?? "—"} />
              <Row k="artifact_hash"   v={shortHash + "…"} tooltip={fullHash} />
              <Row k="rules_evaluated" v={String(audit.rules_evaluated ?? 4)} />
              <Row
                k="rules_triggered"
                v={audit.rules_triggered?.length ? audit.rules_triggered.join(", ") : "none"}
                color={audit.rules_triggered?.length ? "amber" : "muted"}
              />
              <Row
                k="rules_overridden"
                v={(audit.rules_overridden ?? false) ? "true" : "false"}
                color={audit.rules_overridden ? "amber" : undefined}
              />
              <Row
                k="demo_mode"
                v={(audit.demo_mode ?? false) ? "true" : "false"}
                color={audit.demo_mode ? "amber" : "muted"}
              />
              {elapsedMs !== undefined && (
                <Row k="elapsed_ms" v={`${elapsedMs.toLocaleString()} ms`} />
              )}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] text-zinc-600 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  {copied ? (
                    <CheckCheck className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  copy audit.json
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
