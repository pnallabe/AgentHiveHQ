"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { InputPanel } from "@/components/lab/InputPanel";
import { OutputPanel, type OutputState } from "@/components/lab/OutputPanel";
import { ExplanationPanel } from "@/components/lab/ExplanationPanel";
import { AuditPanel } from "@/components/lab/AuditPanel";
import { DemoModeToggle } from "@/components/lab/DemoModeToggle";
import { useDemoMode } from "@/contexts/demo-mode-context";
import { apiClient, type ApiError } from "@/lib/api";
import type { UnderwritingRequest } from "@/lib/types";

const MODEL_VERSION = "v1.0.0";

export default function UnderwritingPage() {
  const { demoMode } = useDemoMode();
  const [outputState, setOutputState] = useState<OutputState>({
    status: "idle",
  });

  const handleDecide = async (payload: UnderwritingRequest) => {
    setOutputState({ status: "loading" });
    const startMs = performance.now();

    try {
      const result = await apiClient.underwriting.decide({
        ...payload,
        demo_mode: demoMode,
      });
      const elapsedMs = Math.round(performance.now() - startMs);
      setOutputState({ status: "result", result, elapsedMs });
    } catch (err) {
      setOutputState({ status: "error", error: err as ApiError });
    }
  };

  const isLoading = outputState.status === "loading";
  const result = outputState.status === "result" ? outputState.result : null;
  const elapsedMs = outputState.status === "result" ? outputState.elapsedMs : undefined;

  return (
    <div className="space-y-4">
      {/* Context bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-zinc-700 bg-zinc-900 font-mono text-xs text-zinc-400"
          >
            {MODEL_VERSION}
          </Badge>
          {demoMode && (
            <Badge className="bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/40 text-xs font-semibold">
              Demo Mode Active
            </Badge>
          )}
        </div>
        <DemoModeToggle />
      </div>

      {/* Main grid: input (380px fixed) | output (flexible) */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <InputPanel onSubmit={handleDecide} isLoading={isLoading} />
        <OutputPanel state={outputState} />
      </div>

      {/* SHAP Explanation chart */}
      {result?.explanations && Object.keys(result.explanations).length > 0 && (
        <ExplanationPanel explanations={result.explanations} />
      )}

      {/* Audit trail */}
      {result?.audit && (
        <AuditPanel
          audit={result.audit}
          decisionId={result.decision_id}
          elapsedMs={elapsedMs}
        />
      )}
    </div>
  );
}
