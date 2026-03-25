"use client";

/**
 * CopilotNarrative — AI-generated natural language explanation of a credit decision.
 *
 * Story 3.6 / 4.5: Renders narrative with a typewriter effect, risk flags,
 * recommendations, and the plain-English APR explainer.
 *
 * Powered by the Genkit credit-copilot-flow (Gemini 2.0 Flash) via server action.
 */

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  AlertTriangle,
  ChevronRight,
  Info,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CopilotResponse } from "@/lib/types";

// ── Typewriter effect hook ────────────────────────────────────────────────────

function useTypewriter(text: string, charsPerTick = 2, tickMs = 8) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;

    if (!text) return;

    const id = setInterval(() => {
      if (indexRef.current >= text.length) {
        clearInterval(id);
        return;
      }
      const end = Math.min(indexRef.current + charsPerTick, text.length);
      setDisplayed(text.slice(0, end));
      indexRef.current = end;
    }, tickMs);

    return () => clearInterval(id);
  }, [text, charsPerTick, tickMs]);

  return displayed;
}

// ── Highlight numbers in rendered text ───────────────────────────────────────

function HighlightedText({ text }: { text: string }) {
  // Match currency ($X,XXX), percentages (XX.XX%), and plain numbers
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?|[\d]+\.?\d*%)/g);
  return (
    <>
      {parts.map((part, i) =>
        /\$[\d,]+|%/.test(part) ? (
          <span key={i} className="font-mono text-sky-300 tabular-nums">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CopilotSkeleton() {
  return (
    <Card className="border-zinc-800 bg-zinc-900/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32 bg-zinc-800" />
            <Skeleton className="h-3 w-20 bg-zinc-800" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-full bg-zinc-800" />
        <Skeleton className="h-4 w-3/4 bg-zinc-800" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-800" />
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-800" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Component props ───────────────────────────────────────────────────────────

interface CopilotNarrativeProps {
  response: CopilotResponse | null;
  isLoading: boolean;
  error?: string;
}

// ── Main component ────────────────────────────────────────────────────────────

export function CopilotNarrative({
  response,
  isLoading,
  error,
}: CopilotNarrativeProps) {
  const narrativeText = useTypewriter(response?.narrative ?? "");

  if (isLoading) return <CopilotSkeleton />;

  if (error) {
    return (
      <Card className="border-red-900/40 bg-red-950/20">
        <CardContent className="pt-5">
          <div className="flex items-start gap-2 text-sm text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!response) return null;

  return (
    <Card className="border-zinc-800 bg-zinc-900/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Bot avatar */}
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-950 ring-1 ring-sky-800">
              <Bot className="h-5 w-5 text-sky-400" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                Copilot Analysis
              </p>
              <p className="flex items-center gap-1 text-xs text-zinc-500">
                <Sparkles className="h-3 w-3" aria-hidden />
                Powered by Gemini 2.0 Flash
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Narrative with typewriter effect */}
        <p className="text-sm leading-relaxed text-zinc-300">
          <HighlightedText text={narrativeText} />
          {narrativeText.length < (response.narrative?.length ?? 0) && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-zinc-400" />
          )}
        </p>

        {/* Risk flags */}
        {response.risk_flags?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Risk Factors
            </h4>
            <div className="space-y-2">
              {response.risk_flags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg bg-amber-950/30 px-3 py-2.5 ring-1 ring-amber-900/40"
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <p className="text-xs leading-relaxed text-amber-200">{flag}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {response.recommendations?.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Recommendations
            </h4>
            <ol className="space-y-1.5">
              {response.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500"
                    aria-hidden
                  />
                  <p className="text-xs leading-relaxed text-zinc-300">
                    <span className="mr-1 font-mono text-zinc-500">{i + 1}.</span>
                    {rec}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* APR explainer */}
        {response.plain_english_apr && (
          <div className="flex items-start gap-2.5 rounded-lg border border-zinc-700/50 bg-zinc-800/40 px-3 py-2.5">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-zinc-400">
              <span className="font-medium text-zinc-300">About your APR: </span>
              {response.plain_english_apr}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
