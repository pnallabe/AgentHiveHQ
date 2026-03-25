"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";
import { cn } from "@/lib/utils";

const TEASERS = [
  {
    slug: "thin-file-underwriting",
    tag: "Credit Inclusion",
    title: "Expanding Credit Access for Thin-File Applicants",
    stat: "+18%",
    statLabel: "approval lift",
    teaser: "Income-first ML model closes the gap for applicants with no credit history.",
  },
  {
    slug: "gig-economy-credit",
    tag: "Risk Segmentation",
    title: "Credit Decisioning for the Gig Economy",
    stat: "+31%",
    statLabel: "approval lift",
    teaser: "Employment-length-tolerant model captures repayment capacity traditional models miss.",
  },
  {
    slug: "model-governance",
    tag: "Compliance",
    title: "Implementing Model Governance for a Regulated Lender",
    stat: "0",
    statLabel: "regulatory findings",
    teaser: "SHAP explainability + immutable audit log meets SR 11-7 model risk guidance.",
  },
];

export function CaseStudyTeasersSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="case-studies"
      className="bg-surface-base py-20 md:py-24"
      aria-labelledby="case-studies-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Case Studies
          </p>
          <h2
            id="case-studies-heading"
            className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50"
          >
            Real outcomes. Real institutions.
          </h2>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {TEASERS.map((cs) => (
            <motion.div key={cs.slug} variants={fadeInUp}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-xl border border-surface-border bg-surface-raised p-5",
                  "transition-colors hover:border-brand-500/30"
                )}
              >
                <span className="inline-block rounded-full border border-brand-800 bg-brand-950 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-brand-300">
                  {cs.tag}
                </span>
                <h3 className="mt-3 font-heading text-sm font-semibold leading-snug text-zinc-100">
                  {cs.title}
                </h3>
                <div className="mt-3">
                  <p className="font-mono text-3xl font-bold tabular-nums text-brand-400">
                    {cs.stat}
                  </p>
                  <p className="text-xs text-zinc-500">{cs.statLabel}</p>
                </div>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-zinc-400">
                  {cs.teaser}
                </p>
                <Link
                  href={`/case-studies/${cs.slug}`}
                  className="mt-4 text-xs font-medium text-brand-400 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded"
                >
                  Read case study →
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
