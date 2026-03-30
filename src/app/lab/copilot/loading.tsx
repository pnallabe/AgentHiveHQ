import { Skeleton } from "@/components/ui/skeleton";

/**
 * AI Copilot page skeleton — shown by Next.js App Router while the
 * "use client" page bundle (including Genkit / Gemini hooks) is loading.
 *
 * Mirrors real layout:
 *   context-bar (badge + toggle) | input-panel (380px) ↔ output-panel | narrative
 */
export default function CopilotLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Context bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Bot icon */}
          <Skeleton className="h-4 w-4 rounded" />
          {/* Model badge */}
          <Skeleton className="h-5 w-36 rounded-full" />
        </div>
        {/* Demo-mode toggle */}
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Main grid: input | output */}
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Input panel ────────────────────────────────────── */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-5">
          <Skeleton className="h-4 w-28 rounded" />

          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}

          <Skeleton className="h-10 w-full rounded-md" />
        </div>

        {/* ── Output panel ────────────────────────────────────── */}
        <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4 flex flex-col justify-center items-center min-h-[340px]">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3 w-52 rounded" />
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

      {/* ── Copilot narrative skeleton ───────────────────────── */}
      <div className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-[90%] rounded" />
          <Skeleton className="h-3 w-[80%] rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-[75%] rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-surface-border p-3 space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-[85%] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
