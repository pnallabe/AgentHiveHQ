import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CASE_STUDIES, getCaseStudy, type CaseStudySection } from "@/lib/case-studies";
import { Logo } from "@/components/shared/Logo";

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export function generateStaticParams() {
  return CASE_STUDIES.map((cs) => ({ slug: cs.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) return {};
  return {
    title: `${cs.title} — Helix Decisions`,
    description: cs.summary,
  };
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function Section({ section }: { section: CaseStudySection }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-100">{section.heading}</h2>

      {section.body && (
        <p className="leading-relaxed text-zinc-400">{section.body}</p>
      )}

      {section.table && (
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-raised">
                {section.table.cols.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={ri % 2 === 0 ? "bg-surface-base" : "bg-surface-raised/40"}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-4 py-2.5 ${
                        ci === 0
                          ? "font-medium text-zinc-300"
                          : "font-mono text-zinc-400"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.blockquote && (
        <blockquote className="border-l-2 border-brand-500 pl-4 text-sm italic text-zinc-400">
          {section.blockquote}
        </blockquote>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CaseStudyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cs = getCaseStudy(slug);
  if (!cs) notFound();

  // Prev / next for navigation
  const idx = CASE_STUDIES.findIndex((c) => c.slug === cs.slug);
  const prev = CASE_STUDIES[idx - 1] ?? null;
  const next = CASE_STUDIES[idx + 1] ?? null;

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Nav */}
      <header className="border-b border-surface-border bg-surface-base/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Logo href="/" size={24} showWordmark />
          <span className="text-zinc-600">/</span>
          <Link
            href="/case-studies"
            className="font-mono text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            case-studies
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-sm text-zinc-400">{cs.slug}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        {/* Back link */}
        <Link
          href="/case-studies"
          className="mb-10 flex items-center gap-1.5 font-mono text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All case studies
        </Link>

        {/* Hero */}
        <div className="mb-12 space-y-4">
          <span
            className={`inline-flex self-start rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest uppercase ${cs.badgeColor}`}
          >
            {cs.category}
          </span>

          <h1 className="text-3xl font-bold leading-snug text-zinc-100">
            {cs.title}
          </h1>

          <p className="text-zinc-400">{cs.summary}</p>

          {/* Headline stat */}
          <div className="inline-flex flex-col rounded-2xl border border-surface-border bg-surface-raised px-6 py-4">
            <span className={`font-mono text-4xl font-bold ${cs.statColor}`}>
              {cs.stat}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {cs.statLabel}
            </span>
          </div>
        </div>

        {/* Body sections */}
        <div className="space-y-10 border-t border-surface-border pt-10">
          {cs.sections.map((section) => (
            <Section key={section.heading} section={section} />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-surface-border bg-surface-raised p-8 text-center">
          <h3 className="mb-1 font-semibold text-zinc-100">
            See it live in the Interactive Lab
          </h3>
          <p className="mb-4 text-sm text-zinc-500">
            Run the same decision scenarios yourself — no setup required.
          </p>
          <Link
            href="/lab"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Open the Lab
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* Prev / Next nav */}
        {(prev || next) && (
          <nav className="mt-12 grid gap-4 sm:grid-cols-2" aria-label="Case study navigation">
            {prev ? (
              <Link
                href={`/case-studies/${prev.slug}`}
                className="group flex flex-col gap-1 rounded-xl border border-surface-border bg-surface-raised p-5 hover:border-zinc-600 hover:bg-surface-overlay transition-all duration-200"
              >
                <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                  <ArrowLeft className="h-3 w-3" />
                  Previous
                </span>
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white">
                  {prev.title}
                </span>
              </Link>
            ) : (
              <div />
            )}
            {next && (
              <Link
                href={`/case-studies/${next.slug}`}
                className="group flex flex-col items-end gap-1 rounded-xl border border-surface-border bg-surface-raised p-5 hover:border-zinc-600 hover:bg-surface-overlay transition-all duration-200"
              >
                <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-600">
                  Next
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="text-right text-sm font-medium text-zinc-300 group-hover:text-white">
                  {next.title}
                </span>
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
