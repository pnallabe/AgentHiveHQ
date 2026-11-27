import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  FileText,
  Scale,
  ListChecks,
  ArrowRight,
  Download,
} from "lucide-react";
import { SampleDownloadForm } from "@/components/audit-package/SampleDownloadForm";

export const metadata: Metadata = {
  title: "Sample Audit Package — AgentHive",
  description:
    "See the exact SR 11-7 Model Validation Report AgentHive generates from live decisioning data — model inventory, validation evidence, fair-lending analysis, and immutable audit trail.",
};

// ── Section previews (mirrors the real generated package structure) ──────────

const SECTIONS = [
  {
    icon: FileText,
    num: "1",
    title: "Model Inventory & Intended Use",
    body: "Model type, owner, deployment mode, data sources, and the segments observed in production — the SR 11-7 §III baseline every validator asks for first.",
    points: [
      "RuleSense underwriting engine — gradient-boosted PD classifier",
      "Monotonic constraints for compliance-safe scoring",
      "Thin-file data sources documented (cash-flow, rent, utilities)",
    ],
  },
  {
    icon: Scale,
    num: "2",
    title: "Validation Evidence & Fair-Lending Testing",
    body: "Live performance monitoring plus a four-fifths-rule adverse-impact analysis computed from real decisions — not a static PDF assembled by hand.",
    points: [
      "Approval rate by segment and by day (90-day window)",
      "Adverse impact ratio with 0.80 disparate-impact flag",
      "SHAP explainability + FCRA/ECOA reason codes on every decline",
    ],
  },
  {
    icon: ListChecks,
    num: "3",
    title: "Governance, Controls & Audit Trail",
    body: "The immutable, hash-chained decision log with model versions and chain of custody — exportable as signed JSON for examiner review.",
    points: [
      "Every decision persisted with input hash + SHAP values",
      "Tenant-scoped access — members export only their own records",
      "Continuous bias monitoring with automated alerts",
    ],
  },
];

export default function AuditPackagePage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Navbar />
      <main className="flex-grow">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 md:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(23,232,189,0.08), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-4xl text-center">
            <span className="inline-block rounded-full border border-brand-700 bg-brand-950 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-300">
              Proof Artifact
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
              The audit package your examiner
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-teal-300 bg-clip-text text-transparent">
                actually asks for.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              AgentHive generates a complete SR 11-7 Model Validation Report from
              live decisioning data — in under 5 minutes, not 6 weeks. Here is
              exactly what it contains.
            </p>
            <div className="mt-10">
              <SampleDownloadForm />
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 border-surface-border text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
              >
                <Link href="/lab/governance">
                  See the Live Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-600">
              Framework: SR 11-7 / OCC 2011-12 · Generated programmatically from live data
            </p>
          </div>
        </section>

        {/* Section breakdown */}
        <section className="border-t border-surface-border bg-surface-raised px-4 py-16 md:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
              Three sections. Zero manual assembly.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-zinc-400">
              Each section maps to what an SR 11-7 validator or OCC/CFPB examiner
              requests — populated from your production decisions.
            </p>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.num}
                    className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-base p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 p-2">
                        <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                      </div>
                      <span className="font-mono text-xs text-zinc-600">
                        Section {s.num}
                      </span>
                    </div>
                    <h3 className="font-heading text-base font-semibold text-zinc-100">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-400">{s.body}</p>
                    <ul className="mt-auto space-y-2 border-t border-surface-border pt-4">
                      {s.points.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 text-xs text-zinc-500"
                        >
                          <ShieldCheck
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400"
                            aria-hidden
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-brand-800 bg-brand-950 px-8 py-12 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
              See it generated from your own decisions.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400">
              Get the sample package now, or request a demo and we&apos;ll run the
              exam-package generator against a live tenant — yours or our synthetic
              portfolio — in the session.
            </p>
            <div className="mt-8">
              <SampleDownloadForm />
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-600">
              Prefer a live walkthrough?{" "}
              <Link
                href="/signup?demo=1"
                className="text-brand-400 underline hover:text-brand-300"
              >
                Request a demo
              </Link>{" "}
              — we reply within 1 business day.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
