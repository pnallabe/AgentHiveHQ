import type { Metadata } from "next";
import { USE_CASES } from "@/lib/use-cases";
import { Logo } from "@/components/shared/Logo";
import { UseCaseCard } from "@/components/showcase/UseCaseCard";

export const metadata: Metadata = {
  title: "Use Cases — Helix Decisions",
  description:
    "Interactive, runnable credit-decisioning use cases: thin-file inclusion, gig-economy underwriting, new-to-country applicants, and model governance.",
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Nav */}
      <header className="border-b border-surface-border bg-surface-base/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Logo href="/" size={24} showWordmark />
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-sm text-zinc-400">showcase</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 max-w-2xl space-y-4">
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Interactive use cases
          </p>
          <h1 className="text-4xl font-bold leading-tight text-zinc-100">
            See a real decision. For your hardest segments.
          </h1>
          <p className="text-base leading-relaxed text-zinc-400">
            Each use case below runs a <strong className="text-zinc-200">live decision</strong> against
            the production underwriting engine — with SHAP explainability, FCRA
            reason codes, and an immutable audit trail. No slides. No mockups.
          </p>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
            Demos run on synthetic data in demo mode. Outcome metrics are
            illustrative targets, not customer results.
          </p>
        </div>

        {/* Use-case grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.slug} useCase={uc} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
          <h2 className="text-xl font-bold text-zinc-100">
            Run it on your own portfolio
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
            We&apos;ll configure a scoped pilot on your data — synthetic or
            anonymized — and walk your risk team through the live decision flow.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a
              href="/signup"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Request a pilot
            </a>
            <a
              href="/lab"
              className="rounded-lg border border-surface-border px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
            >
              Open the Product Lab
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
