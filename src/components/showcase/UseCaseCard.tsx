"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import type { UseCase } from "@/lib/use-cases";
import { SCENARIOS } from "@/components/lab/ScenarioSelector";
import type { UnderwritingResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Decision badge
// ---------------------------------------------------------------------------

const DECISION_STYLE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approve: { label: "Approved", cls: "text-emerald-300", Icon: CheckCircle2 },
  reject: { label: "Declined", cls: "text-red-300", Icon: XCircle },
  review: { label: "Manual Review", cls: "text-amber-300", Icon: AlertCircle },
};

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<UnderwritingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenario = SCENARIOS.find((s) => s.id === useCase.scenarioId);

  const run = async () => {
    if (!scenario) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/underwriting/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scenario.preset,
          demo_mode: true,
          scenario_tag: useCase.scenarioId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not reach the decision engine. Sign in to the Lab to run live."
      );
    } finally {
      setRunning(false);
    }
  };

  const decision = result?.decision;
  const dStyle = decision ? DECISION_STYLE[decision] : null;
  const shapEntries = result?.explanations
    ? Object.entries(result.explanations).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 4)
    : [];

  return (
    <div className="flex flex-col rounded-2xl border border-surface-border bg-surface-raised p-6 transition-colors hover:border-zinc-600">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ring-1", useCase.badge)}>
          {useCase.persona}
        </span>
        {dStyle && (
          <span className={cn("flex items-center gap-1 text-xs font-semibold", dStyle.cls)}>
            <dStyle.Icon className="h-4 w-4" /> {dStyle.label}
          </span>
        )}
      </div>

      <h2 className="text-lg font-bold leading-snug text-zinc-100">{useCase.headline}</h2>

      {/* Pain + approach */}
      <p className="mt-3 text-[13px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-400">The problem: </span>{useCase.pain}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
        <span className="font-semibold text-zinc-400">The approach: </span>{useCase.approach}
      </p>

      {/* What the demo shows */}
      <ul className="mt-4 space-y-1.5">
        {useCase.demoShows.map((d) => (
          <li key={d} className="flex items-start gap-2 text-xs text-zinc-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" aria-hidden />
            {d}
          </li>
        ))}
      </ul>

      {/* Live result */}
      {result && (
        <div className="mt-4 rounded-xl border border-surface-border bg-surface-base p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Live result
            </span>
            {result.audit?.model_version && (
              <span className="font-mono text-[10px] text-zinc-600">
                {result.audit.model_version}
              </span>
            )}
          </div>

          {result.decision === "approve" && (
            <div className="mt-2 flex gap-4 text-sm">
              {result.credit_limit != null && (
                <div>
                  <p className="text-[10px] uppercase text-zinc-600">Limit</p>
                  <p className="font-mono font-bold text-emerald-300">${result.credit_limit.toLocaleString()}</p>
                </div>
              )}
              {result.apr != null && (
                <div>
                  <p className="text-[10px] uppercase text-zinc-600">APR</p>
                  <p className="font-mono font-bold text-emerald-300">{result.apr}%</p>
                </div>
              )}
            </div>
          )}

          {/* SHAP bars */}
          {shapEntries.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {shapEntries.map(([feature, value]) => {
                const pct = Math.min(Math.abs(value) * 100, 100);
                const positive = value >= 0;
                return (
                  <div key={feature} className="flex items-center gap-2">
                    <span className="w-32 truncate font-mono text-[10px] text-zinc-500">{feature}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={cn("h-full rounded-full", positive ? "bg-emerald-500" : "bg-red-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={cn("w-12 text-right font-mono text-[10px]", positive ? "text-emerald-400" : "text-red-400")}>
                      {positive ? "+" : ""}{value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {result.reason_codes && result.reason_codes.length > 0 && (
            <p className="mt-3 border-t border-surface-border pt-2 text-[11px] leading-relaxed text-zinc-500">
              {result.fcra_codes && result.fcra_codes.length > 0 && (
                <span className="font-mono text-amber-400">{result.fcra_codes[0]} — </span>
              )}
              {result.reason_codes[0].replace(/_/g, " ").toLowerCase()}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* Metrics + actions */}
      <div className="mt-5 flex items-end justify-between border-t border-surface-border pt-4">
        <div className="flex gap-6">
          {useCase.metrics.map((m) => (
            <div key={m.label}>
              <p className={cn("font-mono text-xl font-bold", useCase.accent)}>{m.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : result ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {running ? "Running…" : result ? "Run again" : "Run live decision"}
        </button>
        <Link
          href={`/lab/underwriting?scenario=${useCase.scenarioId}`}
          className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500"
        >
          Open in Lab <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
