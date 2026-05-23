"use client";

import Link from "next/link";
import { BrainCircuit, Brain, BarChart3, ArrowRight, Plug } from "lucide-react";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  {
    href: "/lab/underwriting",
    title: "Underwriting Engine",
    description:
      "Submit applicant profiles and receive real-time AI credit decisions with SHAP explanations and full audit trails.",
    Icon: BrainCircuit,
    iconClass: "text-brand-400",
    iconBg: "bg-brand-950",
  },
  {
    href: "/lab/integrations",
    title: "Lucid Credit",
    description:
      "Zero-hallucination AI analytical copilot for credit decisions. Every claim traces back to a source document.",
    Icon: Brain,
    iconClass: "text-sky-400",
    iconBg: "bg-sky-950",
  },
  {
    href: "/lab/governance",
    title: "Governance Dashboard",
    description:
      "Monitor decision patterns, audit trails, approval-rate disparity, and adverse-impact metrics across all segments.",
    Icon: BarChart3,
    iconClass: "text-violet-400",
    iconBg: "bg-violet-950",
  },
  {
    href: "/lab/integrations",
    title: "Integration Gateway",
    description:
      "Connect external AI products to the Lab. Live health status, secure proxy invocation, and audit logging for every external decision.",
    Icon: Plug,
    iconClass: "text-teal-400",
    iconBg: "bg-teal-950",
  },
];

export default function LabPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Product Lab
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          AI-powered credit decisioning tools. Select a module to get started.
        </p>
      </div>

      {/* Product cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {PRODUCTS.map(({ href, title, description, Icon, iconClass, iconBg }) => (
          <Link
            key={title}
            href={href}
            className={cn(
              "group flex flex-col gap-4 rounded-xl border border-surface-border bg-surface-raised p-5",
              "transition-all duration-200",
              "hover:border-brand-500/40 hover:shadow-md hover:shadow-brand-500/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
            )}
          >
            {/* Icon row */}
            <div className="flex items-center justify-between">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>
                <Icon className={cn("h-4.5 w-4.5", iconClass)} aria-hidden />
              </div>
              <ArrowRight
                className="h-4 w-4 text-zinc-600 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-zinc-400"
                aria-hidden
              />
            </div>

            {/* Text */}
            <div>
              <h2 className="font-heading text-sm font-semibold text-zinc-100">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
