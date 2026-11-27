import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  Plug,
  CheckCircle2,
  Clock,
  ArrowRight,
  Webhook,
  Database,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Integrations — AgentHive",
  description:
    "AgentHive fits into your existing lending stack. LOS and core integrations, a REST API, and webhooks — deploy in weeks without rebuilding your workflows.",
};

// ── Integration tiers ────────────────────────────────────────────────────────

const LOS_READY = [
  { name: "MeridianLink", note: "Consumer + mortgage LOS" },
  { name: "Origence", note: "Credit-union lending platform" },
  { name: "Temenos", note: "Core banking + LOS" },
];

const LOS_ROADMAP = [
  { name: "Symitar", note: "Jack Henry core (Episys)" },
  { name: "Fiserv", note: "Core + account processing" },
  { name: "Corelation", note: "Keystone core" },
  { name: "Sync1 Systems", note: "Cloud LOS" },
];

const CAPABILITIES = [
  {
    icon: Webhook,
    title: "REST API + Webhooks",
    body: "Every decision, reason code, and audit event is available over a typed REST API. Subscribe to decision.created, decision.review, and bias.alert webhooks to wire AgentHive into your LOS or case-management flow.",
  },
  {
    icon: Database,
    title: "Data In / Data Out",
    body: "Send applicant data as JSON; receive decision, limit, APR, and SHAP explanations in one call. Bulk export the immutable audit trail as signed JSON for your examiner or data warehouse.",
  },
  {
    icon: ShieldCheck,
    title: "Governance Travels With the Decision",
    body: "Because the audit trail is written at decision time, your LOS record and your compliance record never drift. One decision ID, one chain of custody, end to end.",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Navbar />
      <main className="flex-grow">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(51,102,244,0.12), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <span className="inline-block rounded-full border border-brand-700 bg-brand-950 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-300">
              Integrations
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
              Fits your stack.
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-teal-300 bg-clip-text text-transparent">
                Live in weeks, not quarters.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              AgentHive sits alongside your LOS and core — you keep your
              origination workflow, we add governed, exam-ready decisioning.
              Typical deployment runs six to ten weeks.
            </p>
          </div>
        </section>

        {/* LOS integrations */}
        <section className="border-t border-surface-border bg-surface-raised px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
                LOS & Core
              </p>
              <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
                We meet your loan-origination system where it is.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Pre-built connectors for the platforms mid-market lenders already
                run. Your core stays untouched; your team keeps shipping.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
              {/* Available now */}
              <div className="rounded-2xl border border-teal-500/30 bg-surface-base p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-400" aria-hidden />
                  <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-teal-300">
                    Available now
                  </h3>
                </div>
                <ul className="mt-5 space-y-4">
                  {LOS_READY.map((los) => (
                    <li key={los.name} className="flex items-start gap-3">
                      <Plug className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" aria-hidden />
                      <div>
                        <p className="font-medium text-zinc-100">{los.name}</p>
                        <p className="text-xs text-zinc-500">{los.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* On the roadmap */}
              <div className="rounded-2xl border border-surface-border bg-surface-base p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-500" aria-hidden />
                  <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-zinc-400">
                    On the roadmap
                  </h3>
                </div>
                <ul className="mt-5 space-y-4">
                  {LOS_ROADMAP.map((los) => (
                    <li key={los.name} className="flex items-start gap-3">
                      <Plug className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                      <div>
                        <p className="font-medium text-zinc-300">{los.name}</p>
                        <p className="text-xs text-zinc-600">{los.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-surface-border pt-4 text-xs text-zinc-600">
                  Don&apos;t see your system? We build to your LOS during the pilot.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
              One decision ID. One chain of custody.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {CAPABILITIES.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.title}
                    className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface-raised p-6"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 p-2">
                      <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                    </div>
                    <h3 className="font-heading text-base font-semibold text-zinc-100">
                      {c.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-400">{c.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-4 pb-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-brand-800 bg-brand-950 px-8 py-12 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
              Talk through your integration.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
              Tell us your LOS and we&apos;ll map the exact integration path — and
              show you the exam package it produces — in a 30-minute technical demo.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 bg-brand-500 px-6 text-white hover:bg-brand-600"
              >
                <Link href="/signup?demo=1">
                  Request a Demo
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 border-surface-border text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
              >
                <Link href="/audit-package">See the Audit Package</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
