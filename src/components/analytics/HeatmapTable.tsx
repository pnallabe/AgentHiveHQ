/**
 * HeatmapTable — colour-coded performance vs plan table.
 * Green = above plan, neutral = at plan ±threshold, red = below plan.
 */
"use client";

import { cn } from "@/lib/utils";

export interface HeatmapCell {
  value: number | null;
  plan?: number | null;
  formatted?: string;
}

export interface HeatmapRow {
  label: string;
  cells: HeatmapCell[];
}

export interface HeatmapThresholds {
  /** fraction: 0.05 = 5% variance considered "at plan" */
  neutral: number;
  /** true if higher value is better (default); false for loss/NPL metrics */
  higherIsBetter?: boolean;
}

export interface HeatmapTableProps {
  rows: HeatmapRow[];
  columns: string[];
  thresholds?: HeatmapThresholds;
  title?: string;
  className?: string;
}

function cellColour(
  cell: HeatmapCell,
  thresh: HeatmapThresholds
): string {
  if (cell.value == null || cell.plan == null || cell.plan === 0) return "";
  const ratio = cell.value / cell.plan;
  const diff = ratio - 1;
  const hib = thresh.higherIsBetter !== false;
  const neutral = thresh.neutral;

  if (Math.abs(diff) <= neutral) return "bg-muted/50 text-foreground";
  if ((hib && diff > neutral) || (!hib && diff < -neutral))
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

export function HeatmapTable({
  rows,
  columns,
  thresholds = { neutral: 0.05, higherIsBetter: true },
  title,
  className,
}: HeatmapTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      {title && (
        <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      )}
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b border-border">
              Metric
            </th>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-right font-medium text-muted-foreground border-b border-border"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.label}
              className={cn("border-b border-border/50", ri % 2 === 0 ? "" : "bg-muted/20")}
            >
              <td className="px-3 py-2 font-medium whitespace-nowrap">{row.label}</td>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "px-3 py-2 text-right tabular-nums rounded-sm",
                    cellColour(cell, thresholds)
                  )}
                >
                  {cell.formatted ?? (cell.value != null ? cell.value.toString() : "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
