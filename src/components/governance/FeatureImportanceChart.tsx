"use client";

/**
 * FeatureImportanceChart — Story 4.4 (Overview tab)
 *
 * Computes aggregate (mean absolute) SHAP importances across paginated decision
 * history and renders a horizontal bar chart — identical visual style to ExplanationPanel.
 *
 * Data source: GET /api/underwriting/history (all_time, first page of 100 records)
 * Aggregation: mean |shap_value| per feature across all returned records.
 */

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import type { DecisionRecord } from "@/lib/types";

// ── Feature label map (mirrors ExplanationPanel) ─────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  income_log:         "Annual Income",
  employment_length:  "Employment Length",
  credit_score:       "Credit Score",
  housing_encoded:    "Housing Status",
  thin_file_flag:     "No Credit History",
  debt_to_income:     "Debt-to-Income",
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Aggregation ───────────────────────────────────────────────────────────────

interface FeatureImportance {
  feature: string;
  label: string;
  importance: number; // mean |shap|
}

function aggregate(records: DecisionRecord[]): FeatureImportance[] {
  if (!records.length) return [];

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const rec of records) {
    for (const [feature, value] of Object.entries(rec.shap_values ?? {})) {
      sums[feature] = (sums[feature] ?? 0) + Math.abs(value);
      counts[feature] = (counts[feature] ?? 0) + 1;
    }
  }

  return Object.entries(sums)
    .map(([feature, sum]) => ({
      feature,
      label: featureLabel(feature),
      importance: sum / (counts[feature] ?? 1),
    }))
    .sort((a, b) => b.importance - a.importance);
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  value: number;
  payload: { label: string; importance: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const { label, importance } = payload[0].payload;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-lg">
      <p className="font-medium text-zinc-200">{label}</p>
      <p className="mt-0.5 text-zinc-400">
        Mean |SHAP|: <span className="font-mono text-emerald-400">{importance.toFixed(4)}</span>
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeatureImportanceChart({ onErrorChange }: { onErrorChange?: (hasError: boolean) => void }) {
  const [data, setData] = useState<FeatureImportance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampleSize, setSampleSize] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    apiClient.underwriting
      .history({ page: 1, page_size: 100 })
      .then((res) => {
        if (cancelled) return;
        const agg = aggregate(res.items);
        setData(agg);
        setSampleSize(res.items.length);
        onErrorChange?.(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String((err as Error).message));
          onErrorChange?.(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  if (loading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full rounded bg-zinc-800/60" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="rounded-lg border border-reject-base/30 bg-reject-muted p-3 text-xs text-reject-base">
        Failed to load: {error}
      </div>
    );

  if (!data.length)
    return (
      <p className="text-sm text-zinc-500">
        No decision history found. Make some decisions to see feature importance.
      </p>
    );

  const chartHeight = Math.max(200, data.length * 42);

  return (
    <div>
      <p className="mb-3 text-xs text-zinc-500">
        Mean absolute SHAP value across {sampleSize} most recent decision
        {sampleSize !== 1 ? "s" : ""}. Higher = more influential.
      </p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v: number) => v.toFixed(3)}
          />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke="#52525b" />
          <Bar
            dataKey="importance"
            radius={[0, 4, 4, 0]}
            animationDuration={700}
            animationBegin={0}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.feature}
                fill={index === 0 ? "#10b981" : "#22d3ee"}
                fillOpacity={1 - index * 0.08}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
