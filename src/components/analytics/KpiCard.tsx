/**
 * KpiCard — single KPI tile with sparkline, delta indicator, and alert state.
 *
 * Formatting rules (from Section 6.2):
 *   GBP currency  → £98.7M (always abbreviated for exec view)
 *   Percentage    → 2.1% (1 decimal place)
 *   Basis points  → 148bps
 *   Delta         → ▲ +4.3% green / ▼ -1.8% red / — 0.0% grey
 *   Alert         → amber border + warning icon when threshold crossed
 */
"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type FormatStyle =
  | "currency"
  | "percent"
  | "multiple"
  | "integer"
  | "bps"
  | "days";

export interface KpiCardProps {
  label: string;
  value: number | null | undefined;
  unit: "GBP" | "%" | "x" | "bps" | "days" | "count" | "ratio";
  formatStyle: FormatStyle;
  delta: number | null | undefined;
  deltaLabel: string;
  trend?: number[];
  alertThreshold?: number;
  alertDirection?: "above" | "below";
  size?: "sm" | "md" | "lg";
  tooltip?: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function formatValue(value: number | null | undefined, style: FormatStyle): string {
  if (value === null || value === undefined) return "—";

  switch (style) {
    case "currency": {
      const abs = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      if (abs >= 1_000_000_000)
        return `${sign}£${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000)
        return `${sign}£${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000)
        return `${sign}£${(abs / 1_000).toFixed(0)}K`;
      return `${sign}£${abs.toFixed(0)}`;
    }
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "multiple":
      return `${value.toFixed(1)}x`;
    case "bps":
      return `${Math.round(value * 10_000)}bps`;
    case "days":
      return `${value.toFixed(1)}d`;
    case "integer":
    default:
      return new Intl.NumberFormat("en-GB").format(Math.round(value));
  }
}

function formatDelta(delta: number | null | undefined): {
  text: string;
  colour: string;
  icon: React.ReactNode;
} {
  if (delta === null || delta === undefined)
    return { text: "—", colour: "text-muted-foreground", icon: <Minus className="h-3 w-3" /> };

  const pct = (delta * 100).toFixed(1);
  if (delta > 0.0005)
    return {
      text: `▲ +${pct}%`,
      colour: "text-green-600 dark:text-green-400",
      icon: <TrendingUp className="h-3 w-3" />,
    };
  if (delta < -0.0005)
    return {
      text: `▼ ${pct}%`,
      colour: "text-red-600 dark:text-red-400",
      icon: <TrendingDown className="h-3 w-3" />,
    };

  return {
    text: `— ${pct}%`,
    colour: "text-muted-foreground",
    icon: <Minus className="h-3 w-3" />,
  };
}

function isAlerted(
  value: number | null | undefined,
  threshold: number | undefined,
  direction: "above" | "below" | undefined,
): boolean {
  if (value === null || value === undefined || threshold === undefined) return false;
  return direction === "above" ? value > threshold : value < threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  unit,
  formatStyle,
  delta,
  deltaLabel,
  trend,
  alertThreshold,
  alertDirection = "above",
  size = "md",
  tooltip,
  className,
}: KpiCardProps) {
  const alerted = isAlerted(value, alertThreshold, alertDirection);
  const { text: deltaText, colour: deltaColour } = formatDelta(delta);

  const sparkData = trend?.map((v, i) => ({ i, v })) ?? [];

  const sizeClasses: Record<string, string> = {
    sm: "p-3",
    md: "p-4",
    lg: "p-5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col gap-1 transition-colors",
              sizeClasses[size],
              alerted
                ? "border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-900/10"
                : "border-border",
              className,
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground truncate">
                {label}
              </span>
              {alerted && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>

            {/* Main value */}
            <span
              className={cn(
                "font-bold tabular-nums tracking-tight",
                size === "lg" ? "text-3xl" : size === "sm" ? "text-xl" : "text-2xl",
              )}
            >
              {formatValue(value, formatStyle)}
            </span>

            {/* Delta row */}
            <span className={cn("text-xs", deltaColour)}>
              {deltaText}
              {deltaLabel && (
                <span className="text-muted-foreground ml-1">{deltaLabel}</span>
              )}
            </span>

            {/* Sparkline */}
            {sparkData.length > 1 && (
              <div className="h-8 mt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={alerted ? "#f59e0b" : "#1d4ed8"}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
