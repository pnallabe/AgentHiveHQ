"use client";

/**
 * ExplanationPanel — SHAP feature importance waterfall/bar chart.
 *
 * Story 3.4: Renders signed SHAP values as a horizontal bar chart.
 * Positive (emerald) bars support approval; negative (red) bars reduce likelihood.
 * Sorted by absolute value — most impactful feature at top.
 */

import { Info } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Feature display name map ───────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  income_log:            "Annual Income",
  employment_length:     "Employment Duration",
  housing_encoded:       "Housing Status",
  credit_score_imputed:  "Credit Score",
  thin_file_flag:        "No Credit History",
  dti_ratio:             "Debt-to-Income Ratio",
  income_band:           "Income Band",
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function qualifier(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 0.3) return value > 0 ? "strong positive signal" : "strong negative signal";
  if (abs >= 0.1) return value > 0 ? "moderate positive signal" : "moderate negative signal";
  return value > 0 ? "slight positive signal" : "slight negative signal";
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const { feature, value } = payload[0].payload as { feature: string; value: number };
  const sign = value >= 0 ? "+" : "";
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-zinc-200">{featureLabel(feature)}</p>
      <p className={value >= 0 ? "text-emerald-400" : "text-red-400"}>
        {sign}{value.toFixed(4)} — {qualifier(value)}
      </p>
    </div>
  );
}

// ── Component props ────────────────────────────────────────────────────────────

interface ExplanationPanelProps {
  explanations: Record<string, number>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExplanationPanel({ explanations }: ExplanationPanelProps) {
  const data = Object.entries(explanations)
    .map(([feature, value]) => ({ feature, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);
  const domainPad = maxAbs * 1.25;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Decision Factors</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            SHAP contribution of each factor to this credit decision
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Learn about SHAP values"
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-surface-overlay hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px] border-surface-border bg-surface-overlay text-xs leading-relaxed text-zinc-200">
              SHAP values show each factor&apos;s contribution. Positive (green) supports approval;
              negative (red) reduces likelihood.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-approve-base" />
          Supports approval
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm bg-reject-base" />
          Reduces likelihood
        </span>
      </div>

      {/* Chart */}
      <div
        role="img"
        aria-label={`SHAP feature chart, ${data.length} factors. Top: ${featureLabel(data[0]?.feature ?? "")} = ${data[0]?.value?.toFixed(3) ?? "0"}`}
        className="min-w-[280px]"
      >
        <ResponsiveContainer width="100%" height={data.length * 42 + 28}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
          >
            <XAxis
              type="number"
              domain={[-domainPad, domainPad]}
              tickFormatter={(v: number) => v.toFixed(2)}
              tick={{ fontSize: 10, fill: "#52525b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="feature"
              tickFormatter={featureLabel}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              width={140}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="#3f3f46" strokeDasharray="4 3" strokeWidth={1} />
            <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} animationDuration={700} animationBegin={0}>
              {data.map((entry) => (
                <Cell
                  key={entry.feature}
                  fill={entry.value >= 0 ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Inline end-labels hidden in chart — shown as summary grid */}
      <div className="mt-4 border-t border-surface-border pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Factor Summary
        </p>
        <div className="grid gap-1">
          {data.map((d) => (
            <div key={d.feature} className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-400">{featureLabel(d.feature)}</span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  d.value >= 0 ? "text-approve-base" : "text-reject-base"
                }`}
              >
                {d.value >= 0 ? "+" : ""}{d.value.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
