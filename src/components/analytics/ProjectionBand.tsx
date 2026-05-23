/**
 * ProjectionBand — ComposedChart with p10–p90 shaded area, p50 centre line,
 * actuals line (left of today), and a vertical "today" ReferenceLine.
 */
"use client";

import {
  ComposedChart,
  Area,
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

export interface ProjectionPoint {
  period: string;
  p10?: number | null;
  p50?: number | null;
  p90?: number | null;
  actual?: number | null;
}

export interface ProjectionBandProps {
  data: ProjectionPoint[];
  today?: string;
  height?: number;
  title?: string;
  formatter?: (v: number) => string;
  yLabel?: string;
  accentColour?: string;
  className?: string;
}

const DEFAULT_COLOUR = "#1d4ed8";

function defaultFmt(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `£${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${(v / 1_000).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

export function ProjectionBand({
  data,
  today,
  height = 320,
  title,
  formatter = defaultFmt,
  yLabel,
  accentColour = DEFAULT_COLOUR,
  className,
}: ProjectionBandProps) {
  // Recharts Area for band requires [p10, p90] encoded as a single series with
  // reference area trick — use two overlapping areas: area(p10→p90) stacked.
  // Simpler: encode as { lo, hi } spread using the "range" approach with
  // two Area shapes sharing the same fill by using p10 as base + (p90-p10) as height.
  const enriched = data.map((d) => ({
    ...d,
    bandBase: d.p10 ?? undefined,
    bandHeight:
      d.p10 != null && d.p90 != null ? d.p90 - d.p10 : undefined,
  }));

  return (
    <div
      role="img"
      aria-label={title ?? "Projection band chart"}
      className={cn("w-full", className)}
    >
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={enriched} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={formatter}
            tick={{ fontSize: 11 }}
            label={
              yLabel
                ? { value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 10 } }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number | string, name: string) => {
              const labels: Record<string, string> = {
                actual: "Actual",
                p50: "Forecast (p50)",
                bandBase: "p10",
                bandHeight: "p10–p90 band",
              };
              return [typeof value === "number" ? formatter(value) : value, labels[name] ?? name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => {
              const map: Record<string, string> = {
                actual: "Actual",
                p50: "Forecast (p50)",
                bandBase: "p10–p90 band",
              };
              return map[value] ?? value;
            }}
          />
          {/* p10 invisible base */}
          <Area
            type="monotone"
            dataKey="bandBase"
            stroke="transparent"
            fill="transparent"
            stackId="band"
            isAnimationActive={false}
            legendType="none"
            connectNulls
          />
          {/* p90–p10 visible band */}
          <Area
            type="monotone"
            dataKey="bandHeight"
            stroke="transparent"
            fill={`${accentColour}28`}
            stackId="band"
            name="bandBase"
            isAnimationActive={false}
            connectNulls
          />
          {/* p50 forecast line */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke={accentColour}
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
            isAnimationActive={false}
            name="p50"
            connectNulls
          />
          {/* Actuals line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#374151"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            name="actual"
            connectNulls
          />
          {today && (
            <ReferenceLine
              x={today}
              stroke="#6b7280"
              strokeDasharray="4 2"
              label={{ value: "Today", position: "top", style: { fontSize: 10 } }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
