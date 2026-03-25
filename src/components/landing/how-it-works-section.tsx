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
        </motion.div>

        <motion.div
          className="relative mt-14"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {/* Connector line — desktop only */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-8 hidden h-px border-t border-dashed border-surface-border md:block"
            style={{ top: "32px" }}
          />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  variants={fadeInUp}
                  className="relative flex flex-col items-center text-center md:items-start md:text-left"
                >
                  {/* Number pill + icon */}
                  <div className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-surface-border bg-surface-base">
                    <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                  </div>
                  <div className="absolute -top-2 left-10 z-10 font-mono text-[10px] text-brand-400 md:left-auto md:-top-0 md:right-0">
                    {step.number}
                  </div>

                  <div className="mt-4">
                    <h3 className="font-heading text-base font-semibold text-zinc-100">
                      {step.heading}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
