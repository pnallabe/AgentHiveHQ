import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CASE_STUDIES } from "@/lib/case-studies";
import { Logo } from "@/components/shared/Logo";

export const metadata = {
  title: "Case Studies — Helix Decisions",
  description:
    "See how lending teams use Helix Decisions to make faster, fairer, and fully explainable credit decisions.",
};

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-surface-base">
      {/* Nav */}
      <header className="border-b border-surface-border bg-surface-base/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Logo href="/" size={24} showWordmark />
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-sm text-zinc-400">case-studies</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-20">
        {/* Header */}
        <div className="mb-16 space-y-3">
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Customer stories
          </p>
          <h1 className="text-4xl font-bold text-zinc-100">
            Real decisions. Real outcomes.
          </h1>
          <p className="max-w-lg text-zinc-400">
            See how lending teams use Helix Decisions to approve more qualified
            borrowers, shrink compliance risk, and defend every decision.
          </p>
          <p className="max-w-lg rounded-lg border border-surface-border bg-surface-raised px-4 py-2 text-xs text-zinc-500">
            These are illustrative implementation scenarios based on common
            lending use cases — not named customer results. Metrics shown are
            representative targets.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CASE_STUDIES.map((cs) => (
            <Link
              key={cs.slug}
              href={`/case-studies/${cs.slug}`}
              className="group flex flex-col rounded-xl border border-surface-border bg-surface-raised p-6 transition-all duration-200 hover:border-zinc-600 hover:bg-surface-overlay"
            >
              {/* Category badge */}
              <span
                className={`mb-4 inline-flex self-start rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest uppercase ${cs.badgeColor}`}
              >
                {cs.category}
              </span>

              {/* Title */}
              <h2 className="mb-3 flex-1 text-base font-semibold leading-snug text-zinc-100 group-hover:text-white">
                {cs.title}
              </h2>

              {/* Summary */}
              <p className="mb-6 text-[13px] leading-relaxed text-zinc-500">
                {cs.summary}
              </p>

              {/* Stat */}
              <div className="mb-4 border-t border-surface-border pt-4">
                <span className={`block font-mono text-3xl font-bold ${cs.statColor}`}>
                  {cs.stat}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  {cs.statLabel}
                </span>
              </div>

              {/* CTA */}
              <span className="flex items-center gap-1 font-mono text-[11px] text-brand-400 transition-colors group-hover:text-brand-300">
                Read story
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 rounded-2xl border border-surface-border bg-surface-raised p-10 text-center">
          <h2 className="mb-2 text-2xl font-bold text-zinc-100">
            Ready to write your own story?
          </h2>
          <p className="mb-6 text-zinc-500">
            Start with the interactive lab — no setup required.
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Open the Lab
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </main>
    </div>
  );
}
