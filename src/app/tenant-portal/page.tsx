"use client";

import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { Loader2, ShieldAlert } from "lucide-react";

export default function TenantDashboard() {
  const { tenant, loading, isUnlinked } = useTenant();
  const { user } = useAuth();

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070911]">
        <Loader2 className="h-10 w-10 animate-spin text-[#73B9FF]" aria-label="Loading tenant" />
      </div>
    );
  }

  // ── Signed in but not linked to a tenant ─────────────────────────────────
  if (isUnlinked || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070911] px-6">
        <div className="max-w-md text-center space-y-4">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" aria-hidden />
          <h1 className="text-2xl font-bold text-white">No tenant linked to your account</h1>
          <p className="text-sm leading-relaxed text-gray-400">
            {user?.email ? `${user.email} is` : "Your account is"} not associated with an
            active tenant. Request access and we&apos;ll provision your workspace.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="rounded-lg bg-[#73B9FF] px-4 py-2 text-sm font-semibold text-[#070911] hover:bg-[#9cc9ff] transition-colors"
            >
              Request access
            </Link>
            <Link
              href="/lab"
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 transition-colors"
            >
              Explore the sandbox
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Resolved tenant ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070911] text-white py-10 px-6 font-space-grotesk">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#73B9FF]">{tenant.display_name}</h1>
            <p className="text-gray-400 mt-2">
              Tenant workspace — decisions, governance, and audit for your organisation.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#111625] px-4 py-2 rounded-xl border border-gray-800">
            <span className="text-sm text-gray-400">Tenant:</span>
            <span className="font-mono text-sm text-white">{tenant.slug}</span>
            <span className="rounded-full bg-[#17E8BD]/10 px-2.5 py-0.5 text-xs font-semibold text-[#17E8BD] ring-1 ring-[#17E8BD]/30 capitalize">
              {tenant.role.replace("_", " ")}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-gray-400 ring-1 ring-white/10 capitalize">
              {tenant.plan}
            </span>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Workspace</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <LinkCard
              title="Underwriting Engine"
              description="Run and review credit decisions"
              href="/lab/underwriting"
              icon="🧠"
            />
            <LinkCard
              title="Analytics Dashboards"
              description="Portfolio and risk analytics"
              href="/analytics/overview"
              icon="📊"
            />
            <LinkCard
              title="Governance Suite"
              description="Decision history, bias monitoring, audit"
              href="/lab/governance"
              icon="⚖️"
            />
            <LinkCard
              title="Integration Gateway"
              description="Connected external AI products"
              href="/lab/integrations"
              icon="🔌"
            />
            <LinkCard
              title="Members & Access"
              description="Manage your team and roles"
              href="/tenant-portal/members"
              icon="👥"
            />
            <LinkCard
              title="API Keys"
              description="Programmatic access credentials"
              href="/tenant-portal/api-keys"
              icon="🔑"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function LinkCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: string }) {
  return (
    <Link
      href={href}
      className="bg-[#111625] p-6 rounded-2xl border border-gray-800 hover:border-[#73B9FF] transition-all group flex flex-col justify-between"
    >
      <div>
        <div className="text-2xl mb-3">{icon}</div>
        <h3 className="text-lg font-bold text-white group-hover:text-[#73B9FF] transition-colors">{title}</h3>
        <p className="text-sm text-gray-400 mt-2">{description}</p>
      </div>
      <div className="mt-4 text-[#17E8BD] text-sm font-semibold flex items-center gap-1">
        Open <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}
