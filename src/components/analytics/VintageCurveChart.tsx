/**
 * VintageCurveChart — multi-cohort default-rate curves.
 * Renders up to 8 cohorts; most recent 3 highlighted with thicker strokes.
 */
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export interface VintageCurve {
  cohort: string; // e.g. "2023-Q1"
  points: { month: number; rate: number }[];
}

type FlatRow = Record<string, number | null>;

const PALETTE = [
  "#94a3b8", // slate-400 (oldest)
  "#94a3b8",
  "#64748b", // slate-500
  "#64748b",
  "#475569", // slate-600
  "#a78bfa", // violet-400
  "#7c3aed", // violet-600 (highlight 3)
  "#1d4ed8", // blue-700  (highlight 2)
  "#0ea5e9", // cyan-500  (highlight 1 = most recent)
];

function flattenCurves(curves: VintageCurve[]): FlatRow[] {
  const maxMonths = Math.max(0, ...curves.map((c) => c.points.at(-1)?.month ?? 0));
  return Array.from({ length: maxMonths + 1 }, (_, m) => {
    const row: FlatRow = { month: m };
    for (const c of curves) {
      const pt = c.points.find((p) => p.month === m);
      row[c.cohort] = pt?.rate ?? null;
    }
    return row;
  });
}

export interface VintageCurveChartProps {
  curves: VintageCurve[];
  maxCohorts?: number;
  height?: number;
  title?: string;
  className?: string;
}

export function VintageCurveChart({
  curves,
  maxCohorts = 8,
  height = 320,
  title,
  className,
}: VintageCurveChartProps) {
  // Sort by cohort label descending, take most-recent N
  const sorted = [...curves]
    .sort((a, b) => b.cohort.localeCompare(a.cohort))
    .slice(0, maxCohorts);

  const data = flattenCurves(sorted);
  const total = sorted.length;

  return (
    <div
      role="img"
      aria-label={title ?? "Vintage default-rate curves"}
      className={cn("w-full", className)}
    >
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="month"
            label={{ value: "Months on book", position: "insideBottom", offset: -2, style: { fontSize: 10 } }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(v: number) => [`${(v * 100).toFixed(2)}%`]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine x={0} stroke="transparent" />
          {sorted.map((c, i) => {
            // index 0 = most recent, use PALETTE from the end
            const paletteIdx = Math.max(0, PALETTE.length - 1 - i);
            const colour = PALETTE[paletteIdx];
            const isHighlighted = i < 3;
            return (
              <Line
                key={c.cohort}
                type="monotone"
                dataKey={c.cohort}
                name={c.cohort}
                stroke={colour}
                strokeWidth={isHighlighted ? 2.5 : 1.2}
                dot={false}
                connectNulls
                strokeOpacity={isHighlighted ? 1 : 0.55}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      {total > maxCohorts && (
        <p className="text-xs text-muted-foreground mt-1 text-right">
          Showing {maxCohorts} most-recent cohorts of {total}
        </p>
      )}
    </div>
  );
}
