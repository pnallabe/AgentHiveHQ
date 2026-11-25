import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Scale, Lock, Building2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "About Us | Helix Decisions by AgentHive",
  description: "Learn about Helix Decisions, our mission in fair lending infrastructure, model risk governance under SR 11-7, and our leadership team.",
};

const STATS = [
  { label: "Credit Volume Evaluated (demo)", value: "$2.4B+" },
  { label: "Median Decision Latency (demo)", value: "340ms" },
  { label: "Thin-File Approval Lift (target)", value: "+18%" },
  { label: "Audit Trail Coverage", value: "100%" },
];

const LEADERSHIP = [
  {
    name: "Swarnabale Nallabe",
    role: "Founder & Chief Architect",
    bio: "Specializing in credit risk underwriting engines, automated governance systems, and low-latency machine learning pipelines for regulated financial institutions.",
    badge: "Engineering & Credit Risk",
  },
  {
    name: "AgentHive Research Team",
    role: "AI & Model Governance",
    bio: "Building deterministic rule integration with interpretable ML scoring and SHAP factor attribution aligned to SR 11-7 model-risk guidance.",
    badge: "ML & Compliance",
  },
];

const VALUES = [
  {
    icon: <Scale className="h-6 w-6 text-brand-400" />,
    title: "Explainability & Fairness",
    description: "Every credit decision must be audit-ready, traceable, and compliant with FCRA §615 adverse action reason codes.",
  },
  {
    icon: <Lock className="h-6 w-6 text-brand-400" />,
    title: "Zero-Trust Data Isolation",
    description: "Multi-tenant and single-tenant VPC options ensure client proprietary data is never used for global model training.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-brand-400" />,
    title: "SR 11-7 Model Governance",
    description: "Purpose-built for institutional risk officers and bank regulators requiring automated model risk management.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-surface-border bg-surface-base py-20 md:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(51,102,244,0.15), transparent)",
            }}
          />
          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
            <span className="inline-block rounded-full border border-brand-700 bg-brand-950 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-300">
              Our Mission
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl md:text-6xl">
              Building the Infrastructure for{" "}
              <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
                Fair & Scalable Credit
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Helix Decisions by AgentHive provides production-ready AI underwriting, SHAP explainability, and automated model governance for lenders who demand accuracy without compliance risk.
            </p>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-b border-surface-border bg-surface-raised py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="border-l border-surface-border pl-4 first:border-l-0 first:pl-0 md:first:border-l md:first:pl-4">
                  <p className="font-heading text-3xl font-bold tabular-nums text-zinc-50">{stat.value}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Principles */}
        <section className="py-20 md:py-24 bg-surface-base">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-brand-400">Core Architecture</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50">Designed for Regulated Lending</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Lenders shouldn&apos;t have to choose between machine learning predictive lift and regulatory compliance.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {VALUES.map((v) => (
                <div key={v.title} className="rounded-2xl border border-surface-border bg-surface-raised p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-950">
                    {v.icon}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-zinc-100">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Leadership & Engineering Authority */}
        <section className="border-t border-surface-border bg-surface-raised py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-brand-400">Leadership & Expertise</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50">Engineering Authority</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Built by engineers and risk modelers dedicated to transparent, deterministic AI decision systems.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
              {LEADERSHIP.map((leader) => (
                <div key={leader.name} className="flex flex-col rounded-2xl border border-surface-border bg-surface-base p-6">
                  <span className="w-fit rounded-full border border-brand-800 bg-brand-950 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-300">
                    {leader.badge}
                  </span>
                  <h3 className="mt-4 font-heading text-xl font-bold text-zinc-100">{leader.name}</h3>
                  <p className="text-xs font-mono text-brand-400">{leader.role}</p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{leader.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Institutional & Investor CTA */}
        <section className="bg-surface-base py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="rounded-3xl border border-brand-500/30 bg-gradient-to-b from-brand-950/40 to-surface-raised p-8 md:p-12 shadow-2xl">
              <Building2 className="mx-auto h-10 w-10 text-brand-400" />
              <h2 className="mt-4 font-heading text-3xl font-bold text-zinc-50">Institutional & Investor Inquiries</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300">
                Interested in evaluating our AI credit decisioning platform, reviewing our investor pitch deck, or partnering for pilot deployment?
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white">
                  <Link href="/signup">
                    Request VC Deck & Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-surface-border text-zinc-300 hover:bg-surface-overlay">
                  <Link href="/engineering">Explore Architecture</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
