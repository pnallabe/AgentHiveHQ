import { Skeleton } from "@/components/ui/skeleton";

/**
 * Integration Gateway page skeleton — shown by Next.js App Router while the
 * "use client" page bundle and registry API call are loading.
 *
 * Mirrors real layout:
 *   header (title + refresh) | stats bar | 5-col grid: [products ×2] [invoke panel ×3]
 */
export default function IntegrationsLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56 rounded" />
          <Skeleton className="h-3.5 w-80 rounded" />
        </div>
        {/* Refresh button */}
        <Skeleton className="h-9 w-24 rounded-md shrink-0" />
      </div>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-zinc-800 pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-16 rounded" />
        ))}
      </div>

      {/* ── Main grid: product list | invoke panel ───────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Product list (left 2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-3 w-36 rounded mb-1" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-[75%] rounded" />
                  <Skeleton className="h-2.5 w-32 rounded" />
                </div>
                <Skeleton className="h-4 w-4 rounded shrink-0 mt-0.5" />
              </div>
            </div>
          ))}
        </div>

        {/* Invoke panel (right 3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected product header */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full rounded" />
          </div>

          {/* Dynamic input form */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <Skeleton className="h-4 w-24 rounded" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
            <Skeleton className="h-10 w-full rounded-md mt-2" />
          </div>

          {/* Result panel placeholder */}
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 space-y-3 flex flex-col items-center justify-center">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-56 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
