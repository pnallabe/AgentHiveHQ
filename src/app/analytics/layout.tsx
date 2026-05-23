/**
 * /analytics layout — server component wrapper that delegates to AnalyticsShell.
 *
 * AnalyticsLayoutClient calls useSearchParams(), which requires a <Suspense>
 * boundary above it so Next.js can statically generate the shell without
 * blocking on search-param resolution.
 */
import { Suspense, type ReactNode } from "react";
import { AnalyticsLayoutClient } from "./AnalyticsLayoutClient";

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AnalyticsLayoutClient>{children}</AnalyticsLayoutClient>
    </Suspense>
  );
}
