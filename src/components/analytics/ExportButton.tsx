/**
 * ExportButton — triggers PDF report download.
 * Revalidates all analytics SWR hooks first (mutateAll), then opens the PDF URL.
 */
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildExportPdfUrl } from "@/lib/analytics-api";
import { useAnalyticsMutations } from "@/hooks/useAnalytics";
import { cn } from "@/lib/utils";
import type { PeriodToken } from "./PeriodPicker";
import type { ProductFilter } from "./ProductToggle";

export interface ExportButtonProps {
  period?: PeriodToken;
  product?: ProductFilter;
  /** Optional async callback run before opening the PDF (e.g. for logging) */
  onBeforeExport?: () => Promise<void>;
  className?: string;
}

export function ExportButton({ period = "ytd", product = "all", onBeforeExport, className }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const mutateAll = useAnalyticsMutations(period, product);

  async function handleExport() {
    try {
      setLoading(true);
      // Revalidate all hooks so the PDF backend has fresh cache
      await mutateAll();
      await onBeforeExport?.();
      const url = buildExportPdfUrl(period, product);
      window.open(url, "_blank", "noreferrer");
    } catch (err) {
      console.error("[ExportButton] export failed", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className={cn("gap-1.5", className)}
      aria-label="Export PDF report"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{loading ? "Preparing…" : "Export PDF"}</span>
    </Button>
  );
}
