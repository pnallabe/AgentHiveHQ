"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Scale, Brain, ShieldCheck, Plug } from "lucide-react";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import type { ProductSummary } from "@/lib/types";

// The LucidCredit integration is promoted to a native product slot when healthy.
const LUCIDCREDIT_PRODUCT_ID = "lucidcredit-copilot-v1";

const STATIC_PRODUCTS = [
  {
    icon: Scale,
    name: "Underwriting Engine",
    description:
      "ML-powered credit decisions with income-first modelling for prime, near-prime, and thin-file applicants.",
    href: "/tenant-portal",
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
  const [lucidCredit, setLucidCredit] = useState<ProductSummary | null>(null);
  const [otherIntegrations, setOtherIntegrations] = useState<ProductSummary[]>([]);

  useEffect(() => {
    apiClient.integrations
      .list()
      .then((products) => {
        const healthy = products.filter((p) => p.health_status === "healthy");
        setLucidCredit(healthy.find((p) => p.product_id === LUCIDCREDIT_PRODUCT_ID) ?? null);
        setOtherIntegrations(healthy.filter((p) => p.product_id !== LUCIDCREDIT_PRODUCT_ID));
      })
      .catch(() => {
        // Silently ignore — integrations are optional on the landing page
      });
  }, []);

  const totalCount = STATIC_PRODUCTS.length + (lucidCredit ? 1 : 0) + otherIntegrations.length;

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
            {totalCount === 3 ? "Three tools. One credit stack." : `${totalCount} tools. One credit stack.`}
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
          {/* Static native products */}
          {STATIC_PRODUCTS.map((product) => {
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

          {/* LucidCredit — rendered as a native product card when integration is healthy */}
          {lucidCredit && (
            <motion.div key={lucidCredit.product_id} variants={fadeInUp}>
              <Link
                href="/lab/integrations"
                className={cn(
                  "group flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-raised p-6",
                  "transition-all duration-300",
                  "hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 p-2">
                  <Brain className="h-5 w-5 text-brand-400" aria-hidden />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading text-base font-semibold text-zinc-100">
                    {lucidCredit.display_name}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    {lucidCredit.description}
                  </p>
                </div>
                <span className="text-sm font-medium text-brand-400 group-hover:underline">
                  Explore →
                </span>
              </Link>
            </motion.div>
          )}

          {/* Other healthy integrations */}
          {otherIntegrations.map((product) => (
            <motion.div key={product.product_id} variants={fadeInUp}>
              <Link
                href="/lab/integrations"
                className={cn(
                  "group flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-raised p-6",
                  "transition-all duration-300",
                  "hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                )}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950 p-2">
                  <Plug className="h-5 w-5 text-teal-400" aria-hidden />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-semibold text-zinc-100">
                      {product.display_name}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-emerald-950 border border-emerald-700/30 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      Live
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                    {product.description}
                  </p>
                </div>
                <span className="text-sm font-medium text-teal-400 group-hover:underline">
                  Explore →
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
