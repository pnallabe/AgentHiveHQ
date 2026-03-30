import { Skeleton } from "@/components/ui/skeleton";

/**
 * Underwriting page skeleton — shown by Next.js App Router while the
 * "use client" page bundle is streaming / lazy-loading components.
 *
 * Mirrors the real layout:  context-bar | input-panel (380px) | output-panel
 */
export default function UnderwritingLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Context bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Input panel */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-5">
          <Skeleton className="h-4 w-24 rounded" />

          {/* Form field rows */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}

          <Skeleton className="h-10 w-full rounded-md mt-2" />
        </div>

        {/* Output panel */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4 flex flex-col justify-center items-center min-h-[340px]">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-56 rounded" />
          <div className="w-full grid grid-cols-2 gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-surface-border p-3 space-y-1.5">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
