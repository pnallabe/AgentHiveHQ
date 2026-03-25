"use client";

import Link from "next/link";
import { BrainCircuit, MessageSquare, BarChart3, ArrowRight, Plug } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PRODUCTS = [
  {
    href: "/lab/underwriting",
    title: "Underwriting Engine",
    description:
      "Submit applicant profiles and receive real-time AI credit decisions with SHAP explanations and full audit trails.",
    Icon: BrainCircuit,
    iconColor: "text-primary",
    available: true,
  },
  {
    href: "/lab/copilot",
    title: "AI Copilot",
    description:
      "Generate natural-language explanations of credit decisions. Ideal for analyst briefings and applicant communication.",
    Icon: MessageSquare,
    iconColor: "text-sky-400",
    available: true,
  },
  {
    href: "/lab/governance",
    title: "Governance Dashboard",
    description:
      "Monitor decision patterns, audit trails, approval-rate disparity, and adverse-impact metrics across all segments.",
    Icon: BarChart3,
    iconColor: "text-violet-400",
    available: true,
  },
  {
    href: "/lab/integrations",
    title: "Integration Gateway",
    description:
      "Connect external FastAPI AI products to the Lab. Live health status, secure proxy invocation, and audit logging for every external decision.",
    Icon: Plug,
    iconColor: "text-teal-400",
    available: true,
  },
];

export default function LabPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
          Product Lab
        </h1>
        <p className="mt-2 text-zinc-400">
          AI-powered credit decisioning tools. Select a module to get started.
        </p>
      </div>

      {/* Product cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map(({ href, title, description, Icon, iconColor, available }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-zinc-800 bg-zinc-900 p-0 transition-all hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Card className="h-full border-0 bg-transparent shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden />
                  {available && (
                    <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400" aria-hidden />
                  )}
                </div>
                <CardTitle className="text-base font-semibold text-zinc-100">
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed text-zinc-500">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
