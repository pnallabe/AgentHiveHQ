/**
 * AiBriefCard — collapsible AI executive brief panel.
 * Closed by default; shows "Sample Data" badge in demo mode.
 */
"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExecutiveBrief {
  headline: string;
  summary: string;
  highlights: string[];
  risks: string[];
  generated_at?: string | null;
}

export interface AiBriefCardProps {
  brief?: ExecutiveBrief;
  isLoading?: boolean;
  isDemo?: boolean;
  className?: string;
}

export function AiBriefCard({ brief, isLoading, isDemo, className }: AiBriefCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
        className
      )}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
        aria-controls="ai-brief-body"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold">AI Executive Brief</span>
          {isDemo && (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">
              Sample Data
            </Badge>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Collapsible body */}
      <div
        id="ai-brief-body"
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-3 bg-muted animate-pulse rounded w-full" />
                ))}
              </div>
            ) : !brief ? (
              <p className="text-xs text-muted-foreground italic">
                No brief available. Click refresh to generate.
              </p>
            ) : (
              <>
                {/* Headline */}
                <p className="text-sm font-medium leading-snug">{brief.headline}</p>
                {/* Summary */}
                <p className="text-xs text-muted-foreground leading-relaxed">{brief.summary}</p>
                {/* Highlights */}
                {brief.highlights.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-1">Highlights</p>
                    <ul className="space-y-0.5">
                      {brief.highlights.map((h, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <span className="text-emerald-500 mt-0.5">▸</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Risks */}
                {brief.risks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-1">Watch items</p>
                    <ul className="space-y-0.5">
                      {brief.risks.map((r, i) => (
                        <li key={i} className="flex gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {brief.generated_at && (
                  <p className="text-[10px] text-muted-foreground text-right">
                    Generated {new Date(brief.generated_at).toLocaleString()}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
