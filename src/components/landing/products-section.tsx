"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Scale, MessageSquareCode, ShieldCheck } from "lucide-react";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  {
    icon: Scale,
    name: "Underwriting Engine",
    description:
      "ML-powered credit decisions with income-first modelling for prime, near-prime, and thin-file applicants.",
    href: "/lab/underwriting",
  },
  {
    icon: MessageSquareCode,
    name: "AI Copilot",
    description:
      "Natural language explanations for every decision. Built for credit analysts, not just engineers.",
    href: "/lab/copilot",
  },
  {
    icon: ShieldCheck,
    name: "Governance Suite",
    description:
      "Immutable audit logs, SHAP explainability, bias monitoring, and FCRA-compliant reason codes.",
    href: "/lab/governance",
  },
];

export function ProductsSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="products"
      className="bg-surface-base py-20 md:py-24"
      aria-labelledby="products-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Products
          </p>
          <h2
            id="products-heading"
            className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50"
          >
            Three tools. One credit stack.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            From underwriting to explainability to governance — every layer you need,
            purpose-built for regulated lending.
          </p>
        </motion.div>

        <motion.div
          className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {PRODUCTS.map((product) => {
            const Icon = product.icon;
            return (
              <motion.div key={product.name} variants={fadeInUp}>
                <Link
                  href={product.href}
                  className={cn(
                    "group flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-raised p-6",
                    "transition-all duration-300",
                    "hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 p-2">
                    <Icon className="h-5 w-5 text-brand-400" aria-hidden />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading text-base font-semibold text-zinc-100">
                      {product.name}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                      {product.description}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-brand-400 group-hover:underline">
                    Explore →
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
