/**
 * TrendChart — dual-axis capable line/area chart for time-series data.
 * Wraps Recharts in a ResponsiveContainer with ARIA role="img".
 */
"use client";

import {
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export type SeriesType = "line" | "area" | "bar";

export interface TrendSeries {
  dataKey: string;
  label: string;
  type?: SeriesType;
  colour?: string;
  yAxisId?: "left" | "right";
  strokeDasharray?: string;
  formatter?: (v: number) => string;
}

export interface TrendChartProps {
  data: Record<string, string | number | null>[];
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  title?: string;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
}

const COLOURS = [
  "#1d4ed8", // blue-700
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#0891b2", // cyan-600
];

export function TrendChart({
  data,
  series,
  xKey = "period",
  height = 300,
  title,
  leftLabel,
  rightLabel,
  className,
}: TrendChartProps) {
  const hasDualAxis = series.some((s) => s.yAxisId === "right");

  return (
    <div
      role="img"
      aria-label={title ?? "Trend chart"}
      className={cn("w-full", className)}
    >
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            label={
              leftLabel
                ? {
                    value: leftLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 10 },
                  }
                : undefined
            }
          />
          {hasDualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11 }}
              label={
                rightLabel
                  ? {
                      value: rightLabel,
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 10 },
                    }
                  : undefined
              }
            />
          )}
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value, name) => {
              const s = series.find((s) => s.dataKey === name);
              const v = Number(value);
              return [s?.formatter ? s.formatter(v) : v, s?.label ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => series.find((s) => s.dataKey === value)?.label ?? value}
          />
          {series.map((s, i) => {
            const colour = s.colour ?? COLOURS[i % COLOURS.length];
            const yId = s.yAxisId ?? "left";
            if (s.type === "area")
              return (
                <Area
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  stroke={colour}
                  fill={`${colour}22`}
                  yAxisId={yId}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            if (s.type === "bar")
              return (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  fill={colour}
                  yAxisId={yId}
                  isAnimationActive={false}
                />
              );
            return (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                stroke={colour}
                yAxisId={yId}
                strokeWidth={2}
                dot={false}
                strokeDasharray={s.strokeDasharray}
                isAnimationActive={false}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
