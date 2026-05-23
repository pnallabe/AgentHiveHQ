/**
 * WaterfallChart — P&L waterfall using Recharts BarChart with stacked invisible base.
 * Positive items = emerald, negative = red, subtotal/total = brand blue.
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export type WaterfallItemType = "positive" | "negative" | "subtotal" | "total";

export interface WaterfallItem {
  label: string;
  value: number;
  type?: WaterfallItemType;
}

interface WaterfallDatum {
  label: string;
  base: number;
  value: number;
  raw: number;
  type: WaterfallItemType;
}

const COLOURS: Record<WaterfallItemType, string> = {
  positive: "#059669",
  negative: "#dc2626",
  subtotal: "#1d4ed8",
  total: "#1d4ed8",
};

function buildData(items: WaterfallItem[]): WaterfallDatum[] {
  let running = 0;
  return items.map((item) => {
    const type: WaterfallItemType =
      item.type ??
      (item.label.toLowerCase().includes("total") ||
      item.label.toLowerCase().includes("subtotal")
        ? "subtotal"
        : item.value >= 0
        ? "positive"
        : "negative");

    const isFloat = type === "subtotal" || type === "total";
    const base = isFloat ? 0 : item.value < 0 ? running + item.value : running;
    const barValue = Math.abs(item.value);

    if (!isFloat) running += item.value;
    else running = item.value; // subtotals reset the running total

    return { label: item.label, base, value: barValue, raw: item.value, type };
  });
}

function formatGbp(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${(v / 1_000).toFixed(1)}k`;
  return `£${v.toFixed(0)}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: WaterfallDatum }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className={d.raw < 0 ? "text-red-600" : "text-emerald-600"}>
        {formatGbp(d.raw)}
      </p>
    </div>
  );
}

export interface WaterfallChartProps {
  items: WaterfallItem[];
  height?: number;
  title?: string;
  className?: string;
}

export function WaterfallChart({ items, height = 320, title, className }: WaterfallChartProps) {
  const data = buildData(items);

  return (
    <div
      role="img"
      aria-label={title ?? "Waterfall chart"}
      className={cn("w-full", className)}
    >
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatGbp} tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          {/* Invisible base bar */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          {/* Visible value bar */}
          <Bar dataKey="value" stackId="waterfall" isAnimationActive={false}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={COLOURS[entry.type]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
