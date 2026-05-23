/**
 * DataFreshnessTag — shows when the data was last refreshed.
 */
"use client";

import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataFreshnessTagProps {
  dataAsOf?: string | null;
  className?: string;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const hhmm = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    });
    return `Data as of ${hhmm} UTC`;
  } catch {
    return "Data as of —";
  }
}

export function DataFreshnessTag({ dataAsOf, className }: DataFreshnessTagProps) {
  if (!dataAsOf) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] text-muted-foreground",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        Loading…
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] text-muted-foreground",
        className
      )}
      title={new Date(dataAsOf).toISOString()}
    >
      <Clock className="h-3 w-3" />
      {formatTimestamp(dataAsOf)}
    </span>
  );
}
