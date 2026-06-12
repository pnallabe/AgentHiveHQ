"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Zap, Building2, ArrowRight } from "lucide-react";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";
import { cn } from "@/lib/utils";

// ── Tier definitions ─────────────────────────────────────────────────────────

// TODO: replace with helixdecisions.ai Calendly link
const DEMO_BOOKING_URL = "https://calendly.com/helixdecisions/demo";

interface Tier {
  id:          string;
  icon:        React.ReactNode;
  label:       string;
  price:       string;
  priceSub:    string;
  description: string;
  highlighted: boolean;
  cta:         { label: string; href: string; external?: boolean };
  features:    string[];
  limit:       string;
}

const TIERS: Tier[] = [
  {
    id:          "starter",
    icon:        <Zap className="h-4 w-4" />,
    label:       "Starter",
    price:       "$499",
    priceSub:    "/ month",
    description: "Ideal for fintechs, CDFIs, and credit-union pilots evaluating AI underwriting.",
    highlighted: false,
    cta:         { label: "Start Free Trial", href: "/signup" },
    limit:       "Up to 1,000 decisions / month",
    features: [
      "Underwriting Engine (ML + rules)",
      "SHAP explainability per decision",
      "Adverse-action reason codes",
      "REST API + TypeScript SDK",
      "Basic governance dashboard",
      "99.9% uptime SLA",
      "Community support",
    ],
  },
  {
    id:          "growth",
    icon:        <Building2 className="h-4 w-4" />,
    label:       "Growth",
    price:       "$1,999",
    priceSub:    "/ month",
    description: "For scaling lenders who need production throughput, bias monitoring, and dedicated support.",
    highlighted: true,
    cta:         { label: "Book a Demo", href: DEMO_BOOKING_URL, external: true },
    limit:       "Up to 20,000 decisions / month",
    features: [
      "Everything in Starter",
      "Full governance suite (SR 11-7 ready)",
      "Four-fifths rule & adverse-impact reports",
      "AI Copilot (decisioning assistant)",
      "Integration Gateway (webhooks + LOS)",
      "Model fine-tuning (quarterly)",
      "99.95% uptime SLA",
      "Dedicated Slack support channel",
    ],
  },
  {
    id:          "enterprise",
    icon:        <Building2 className="h-4 w-4" />,
    label:       "Enterprise",
    price:       "Custom",
    priceSub:    "pricing",
    description: "For regulated institutions needing private deployment, SOC 2, and custom model governance.",
    highlighted: false,
    cta:         { label: "Talk to Sales", href: DEMO_BOOKING_URL, external: true },
    limit:       "Unlimited decisions",
    features: [
      "Everything in Growth",
      "Private cloud / on-premise deployment",
      "Custom model training on your data",
      "SSO + SCIM provisioning",
      "SOC 2 Type II & FCRA compliance package",
      "Dedicated CSM + SLA negotiation",
      "99.99% uptime SLA",
      "24/7 priority support",
    ],
  },
];

// ── Subcomponent: Feature list ────────────────────────────────────────────────

function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="mt-6 space-y-2.5 flex-1">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
          <Check
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400"
            aria-hidden
          />
          {f}
        </li>
      ))}
    </ul>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function PricingSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section
      id="pricing"
      className="bg-surface-base py-20 md:py-28"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
          className="text-center"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-brand-400">
            Pricing
          </p>
          <h2
            id="pricing-heading"
            className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50"
          >
            Transparent pricing.
            <br className="hidden sm:block" />{" "}
            <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              Scale when you&apos;re ready.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Start with a free trial. No commitment until you&apos;re in production.
            All plans include SHAP explainability and FCRA-compliant adverse-action codes.
          </p>
        </motion.div>

        {/* Tier cards */}
        <motion.div
          className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3"
          variants={staggerChildren}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          {TIERS.map((tier) => (
            <motion.div key={tier.id} variants={fadeInUp} className="flex">
              <div
                className={cn(
                  "relative flex w-full flex-col rounded-2xl border p-6",
                  "transition-colors",
                  tier.highlighted
                    ? "border-brand-500 bg-brand-950/60 shadow-lg shadow-brand-900/30"
                    : "border-surface-border bg-surface-raised hover:border-brand-500/30",
                )}
              >
                {/* Most Popular badge */}
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-white shadow">
                    Most Popular
                  </span>
                )}

                {/* Tier header */}
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-md p-1.5",
                      tier.highlighted
                        ? "bg-brand-500/20 text-brand-300"
                        : "bg-zinc-800 text-zinc-400",
                    )}
                  >
                    {tier.icon}
                  </span>
                  <span className="font-heading text-sm font-semibold text-zinc-200">
                    {tier.label}
                  </span>
                </div>

                {/* Price */}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-heading text-3xl font-bold tracking-tight text-zinc-50">
                    {tier.price}
                  </span>
                  <span className="text-sm text-zinc-500">{tier.priceSub}</span>
                </div>

                {/* Volume limit */}
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                  {tier.limit}
                </p>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  {tier.description}
                </p>

                {/* Feature list */}
                <FeatureList features={tier.features} />

                {/* CTA */}
                <div className="mt-8">
                  {tier.cta.external ? (
                    <Button
                      asChild
                      size="default"
                      className={cn(
                        "w-full",
                        tier.highlighted
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "border border-surface-border bg-transparent text-zinc-200 hover:bg-surface-overlay",
                      )}
                    >
                      <a href={tier.cta.href} target="_blank" rel="noopener noreferrer">
                        {tier.cta.label}
                        <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="default"
                      className={cn(
                        "w-full",
                        tier.highlighted
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "border border-surface-border bg-transparent text-zinc-200 hover:bg-surface-overlay",
                      )}
                    >
                      <Link href={tier.cta.href}>
                        {tier.cta.label}
                        <ArrowRight className="ml-2 h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom note */}
        <motion.p
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
          className="mt-10 text-center font-mono text-xs text-zinc-600"
        >
          All plans billed monthly. Annual billing available at 20% discount. No overage fees — decisions pause gracefully at limit.
        </motion.p>
      </div>
    </section>
  );
}
