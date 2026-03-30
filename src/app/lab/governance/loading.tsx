import { Skeleton } from "@/components/ui/skeleton";

/**
 * Governance page skeleton — shown by Next.js App Router while the
 * dashboard data and chart bundles are loading.
 *
 * Mirrors the real layout: period selector | 4× KPI cards | tabs with charts
 */
export default function GovernanceLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header row: title + period selector */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-44 rounded" />
          <Skeleton className="h-3 w-64 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* KPI cards row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-20 rounded" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            {/* Sparkline */}
            <Skeleton className="h-8 w-full rounded" />
          </div>
        ))}
      </div>

      {/* Tabs bar */}
      <div className="flex gap-1 border-b border-surface-border pb-0">
        {["Overview", "Decision History", "Bias Report"].map((tab) => (
          <Skeleton key={tab} className="h-9 w-32 rounded-t-md" />
        ))}
      </div>

      {/* Tab content area — chart skeletons */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Approval rate chart */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-3">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>

        {/* Feature importance chart */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-3">
          <Skeleton className="h-4 w-40 rounded" />
          <div className="space-y-2 mt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton
                  className="h-5 rounded"
                  style={{ width: `${85 - i * 12}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit table skeleton */}
      <div className="rounded-xl border border-surface-border bg-surface-raised overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-5 gap-4 border-b border-surface-border bg-surface-base px-4 py-2">
          {["Decision ID", "Timestamp", "Outcome", "Score", "Reason"].map((col) => (
            <Skeleton key={col} className="h-3 w-full rounded" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-4 border-b border-surface-border px-4 py-3 last:border-b-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
