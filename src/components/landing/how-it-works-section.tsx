"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Inbox, Shield, BrainCircuit, Zap } from "lucide-react";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";

const STEPS = [
  {
    number: "01",
    icon: Inbox,
    heading: "Input",
    description: "Applicant profile submitted via API or Product Lab",
  },
  {
    number: "02",
    icon: Shield,
    heading: "Rules",
    description: "Hard constraints evaluated — FCRA-compliant rejection gates",
  },
  {
    number: "03",
    icon: BrainCircuit,
    heading: "Inference",
    description: "ML model scores the application, SHAP computes factor weights",
  },
  {
    number: "04",
    icon: Zap,
    heading: "Decision",
    description: "Structured JSON response with audit trail — under 500ms",
  },
];

export function HowItWorksSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="border-y border-surface-border bg-surface-raised py-20 md:py-24"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
          className="text-center"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Architecture
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50"
          >
            How It Works
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Four deterministic stages. Every decision is traceable, explainable, and under 500ms.
          </p>
        </motion.div>

        <motion.div
          className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-4"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === STEPS.length - 1;
            return (
              <motion.div
                key={step.number}
                variants={fadeInUp}
                className="relative flex flex-col"
              >
                {/* Step header: icon + connector line */}
                <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-0">
                  {/* Icon circle */}
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface-base">
                    <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                    {/* Step number badge */}
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 font-mono text-[9px] font-bold text-white">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Connector line between steps (mobile: vertical gap, desktop: replaced by border) */}
                  {!isLast && (
                    <div className="hidden h-px flex-1 border-t border-dashed border-surface-border md:block md:ml-0 md:mt-6 md:w-full" />
                  )}
                </div>

                {/* Step body */}
                <div className="mt-4 pl-0">
                  <h3 className="font-heading text-base font-semibold text-zinc-100">
                    {step.heading}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
