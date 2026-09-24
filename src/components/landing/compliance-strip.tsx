"use client";

import { CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";

const ITEMS = [
  "SOC 2 Type II Aligned",
  "256-Bit AES Encryption",
  "FCRA §615 Compliant",
  "SR 11-7 Model Governance",
  "Single-Tenant VPC Support",
  "SHAP Explainability",
  "Immutable Audit Trail",
];

export function ComplianceStrip() {
  const prefersReduced = useReducedMotion();

  return (
    <section
      className="border-t border-surface-border bg-surface-base py-10"
      aria-label="Compliance certifications"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          className="flex flex-row flex-wrap items-center justify-center gap-x-10 gap-y-4"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {ITEMS.map((item) => (
            <motion.div
              key={item}
              variants={fadeInUp}
              className="flex items-center gap-1.5 font-mono text-xs text-zinc-500"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-500 shrink-0" aria-hidden />
              <span>{item}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
