"use client";

/**
 * AI Copilot Lab Page — Story 3.6 / 4.5
 *
 * Flow:
 *   1. InputPanel collects applicant data.
 *   2. apiClient.underwriting.decide() → UnderwritingResponse (FastAPI).
 *   3. getCreditCopilotNarrative() → CopilotOutput (Genkit / Gemini 2.0 Flash server action).
 *   4. OutputPanel (compact) shows structured decision; CopilotNarrative shows LLM prose.
 */

import { useState } from "react";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InputPanel } from "@/components/lab/InputPanel";
import { OutputPanel, type OutputState } from "@/components/lab/OutputPanel";
import { CopilotNarrative } from "@/components/lab/CopilotNarrative";
import { DemoModeToggle } from "@/components/lab/DemoModeToggle";
import { useDemoMode } from "@/contexts/demo-mode-context";
import { apiClient, type ApiError } from "@/lib/api";
import { getCreditCopilotNarrative } from "@/ai/flows/credit-copilot-flow";
import type { CopilotResponse, UnderwritingRequest } from "@/lib/types";

export default function CopilotPage() {
  const { demoMode } = useDemoMode();

  const [outputState, setOutputState] = useState<OutputState>({ status: "idle" });
  const [copilotResponse, setCopilotResponse] = useState<CopilotResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | undefined>();

  const handleDecide = async (payload: UnderwritingRequest) => {
    // ── Reset state ──────────────────────────────────────────────────────────
    setOutputState({ status: "loading" });
    setCopilotResponse(null);
    setCopilotError(undefined);
    setCopilotLoading(false);

    const startMs = performance.now();

    // ── Step 1: Call FastAPI underwriting engine ─────────────────────────────
    let result;
    try {
      result = await apiClient.underwriting.decide({
        ...payload,
        demo_mode: demoMode,
      });
      const elapsedMs = Math.round(performance.now() - startMs);
      setOutputState({ status: "result", result, elapsedMs });
    } catch (err) {
      setOutputState({ status: "error", error: err as ApiError });
      return;
    }

    // ── Step 2: Call Genkit / Gemini server action ───────────────────────────
    setCopilotLoading(true);
    try {
      const copilotOut = await getCreditCopilotNarrative({
        decision_response: result as Parameters<typeof getCreditCopilotNarrative>[0]["decision_response"],
        applicant_context: demoMode ? "Demo mode session" : "",
      });
      // Map to CopilotResponse shape expected by CopilotNarrative
      setCopilotResponse({
        narrative:          copilotOut.narrative,
        risk_flags:         copilotOut.risk_flags,
        recommendations:    copilotOut.recommendations,
        plain_english_apr:  copilotOut.plain_english_apr,
      } satisfies CopilotResponse);
      setCopilotError(undefined);
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : "AI narrative generation failed.");
    } finally {
      setCopilotLoading(false);
    }
  };

  const isSubmitting = outputState.status === "loading";

  return (
    <div className="space-y-4">
      {/* Context bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-sky-500" aria-hidden />
          <Badge
            variant="outline"
            className="border-sky-700/50 bg-sky-950/40 font-mono text-xs text-sky-400"
          >
            Gemini 2.0 Flash
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
        <InputPanel onSubmit={handleDecide} isLoading={isSubmitting} />
        <OutputPanel state={outputState} />
      </div>

      {/* AI Copilot narrative — rendered below the decision grid */}
      {(copilotLoading || copilotResponse || copilotError) && (
        <CopilotNarrative
          response={copilotResponse}
          isLoading={copilotLoading}
          error={copilotError}
        />
      )}
    </div>
  );
}
