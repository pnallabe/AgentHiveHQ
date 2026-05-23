/**
 * BarComparisonChart — grouped or stacked bar chart for period comparisons.
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export interface BarSeries {
  dataKey: string;
  label: string;
  colour?: string;
  formatter?: (v: number) => string;
}

export interface BarComparisonChartProps {
  data: Record<string, string | number | null>[];
  bars: BarSeries[];
  xKey?: string;
  layout?: "horizontal" | "vertical";
  stacked?: boolean;
  height?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  className?: string;
}

const COLOURS = [
  "#1d4ed8",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

export function BarComparisonChart({
  data,
  bars,
  xKey = "period",
  layout = "horizontal",
  stacked = false,
  height = 300,
  title,
  yLabel,
  className,
}: BarComparisonChartProps) {
  return (
    <div
      role="img"
      aria-label={title ?? "Bar comparison chart"}
      className={cn("w-full", className)}
    >
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          {layout === "horizontal" ? (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                label={
                  yLabel
                    ? {
                        value: yLabel,
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 10 },
                      }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11 }} />
            </>
          )}
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => {
              const b = bars.find((b) => b.dataKey === name);
              const v = Number(value);
              return [b?.formatter ? b.formatter(v) : v, b?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => bars.find((b) => b.dataKey === value)?.label ?? value}
          />
          {bars.map((b, i) => (
            <Bar
              key={b.dataKey}
              dataKey={b.dataKey}
              name={b.dataKey}
              fill={b.colour ?? COLOURS[i % COLOURS.length]}
              stackId={stacked ? "stack" : undefined}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
