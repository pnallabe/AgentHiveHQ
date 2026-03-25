/**
 * Lab shell layout — sidebar nav + breadcrumb + demo mode provider.
 * Protected: unauthenticated users are redirected to /login by withAuth.
 *
 * NOTE: Next.js App Router layouts cannot be wrapped with React HOCs directly.
 * We render a client component inside that handles auth + sidebar logic.
 */
import type { ReactNode } from "react";
import { LabShell } from "./LabShell";

export default function LabLayout({ children }: { children: ReactNode }) {
  return <LabShell>{children}</LabShell>;
}
