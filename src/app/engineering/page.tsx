import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Cpu, Server, ShieldCheck, Zap, Code2, GitBranch, ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Engineering Architecture & Tech Stack | Helix Decisions by AgentHive",
  description: "Technical overview of Helix Decisions system architecture, ML inference engine, SHAP explainability pipeline, and low-latency API infrastructure.",
};

const STACK_ITEMS = [
  { category: "ML & Execution", tech: "Python 3.11, LightGBM, PyTorch, SHAP Engine" },
  { category: "API & Backend", tech: "FastAPI, SQLAlchemy, Pydantic v2, AsyncIO" },
  { category: "Database & Storage", tech: "PostgreSQL, Redis Cache, Row-Level Security" },
  { category: "Frontend Framework", tech: "Next.js 14 (App Router), TypeScript, TailwindCSS" },
  { category: "Compliance & Audit", tech: "FCRA §615 Rules Engine, ISO 8601 Audit Log" },
  { category: "Cloud & Security", tech: "GCP App Hosting, Docker, Single-Tenant VPC Support" },
];

const BENCHMARKS = [
  { metric: "P99 Decision Latency", target: "< 480ms", detail: "End-to-end model inference + SHAP computation" },
  { metric: "Rule Evaluation Speed", target: "< 15ms", detail: "Deterministic FCRA & hard constraint filtering" },
  { metric: "Model AUC Performance", target: "0.847", detail: "Validated on thin-file & near-prime credit datasets" },
  { metric: "Audit Trail Compliance", target: "100%", detail: "Immutable event hashing per decision payload" },
];

export default function EngineeringPage() {
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
              Technical Architecture
            </span>
            <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl md:text-6xl">
              Engineering Rigor for{" "}
              <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
                High-Stakes Credit
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Low-latency scoring engines, real-time SHAP explainability calculations, and multi-tenant isolation built for production regulated lending.
            </p>
          </div>
        </section>

        {/* Benchmarks Strip */}
        <section className="border-b border-surface-border bg-surface-raised py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {BENCHMARKS.map((b) => (
                <div key={b.metric} className="border-l border-surface-border pl-4 first:border-l-0 first:pl-0 md:first:border-l md:first:pl-4">
                  <p className="font-heading text-3xl font-bold tabular-nums text-brand-400">{b.target}</p>
                  <p className="mt-1 text-xs font-semibold text-zinc-200">{b.metric}</p>
                  <p className="font-mono text-[10px] text-zinc-500">{b.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive System Architecture Pipeline */}
        <section className="py-20 md:py-24 bg-surface-base">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-brand-400">System Flow</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50">Four-Stage Decision Pipeline</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
                Every request flows through deterministic rule evaluation before machine learning inference.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 text-brand-400 font-mono text-xs font-bold">01</div>
                  <h3 className="mt-4 font-heading text-base font-semibold text-zinc-100">API Ingestion</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">Async JSON payload processing with Pydantic v2 schema validation and HMAC signature authentication.</p>
                </div>
                <div className="mt-4 font-mono text-[10px] text-zinc-500">Latency: &lt; 5ms</div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 text-brand-400 font-mono text-xs font-bold">02</div>
                  <h3 className="mt-4 font-heading text-base font-semibold text-zinc-100">Rule Engine</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">Hard constraint filtering for FCRA compliance gates and immediate rejection policy evaluation.</p>
                </div>
                <div className="mt-4 font-mono text-[10px] text-zinc-500">Latency: &lt; 15ms</div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 text-brand-400 font-mono text-xs font-bold">03</div>
                  <h3 className="mt-4 font-heading text-base font-semibold text-zinc-100">ML Scoring & SHAP</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">Gradient-boosted decision trees compute risk score alongside dynamic SHAP feature weight attributions.</p>
                </div>
                <div className="mt-4 font-mono text-[10px] text-zinc-500">Latency: &lt; 300ms</div>
              </div>

              <div className="rounded-2xl border border-surface-border bg-surface-raised p-6 flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-950 text-brand-400 font-mono text-xs font-bold">04</div>
                  <h3 className="mt-4 font-heading text-base font-semibold text-zinc-100">Immutable Audit</h3>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">Response formatted with FCRA adverse action codes and persisted to immutable audit store.</p>
                </div>
                <div className="mt-4 font-mono text-[10px] text-zinc-500">Total P99: &lt; 480ms</div>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack Matrix */}
        <section id="stack" className="border-t border-surface-border bg-surface-raised py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-brand-400">Tech Stack</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-zinc-50">Production Technology Stack</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Built on modern, type-safe, and high-performance open-source foundations.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {STACK_ITEMS.map((item) => (
                <div key={item.category} className="rounded-xl border border-surface-border bg-surface-base p-5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-brand-400">{item.category}</span>
                  <h3 className="mt-2 text-sm font-semibold text-zinc-100">{item.tech}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Developer & GitHub CTA */}
        <section className="bg-surface-base py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <div className="rounded-3xl border border-surface-border bg-surface-raised p-8 md:p-12 shadow-xl">
              <Code2 className="mx-auto h-10 w-10 text-brand-400" />
              <h2 className="mt-4 font-heading text-3xl font-bold text-zinc-50">Inspect Code & API Specs</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Explore our interactive Product Lab or review open-source repositories and integration patterns.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="bg-brand-500 hover:bg-brand-600 text-white">
                  <Link href="/lab/underwriting">
                    Test Live API in Lab
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-surface-border text-zinc-300 hover:bg-surface-overlay">
                  <a href="https://github.com/pnallabe/AgentHiveHQ" target="_blank" rel="noreferrer">
                    <GitBranch className="mr-2 h-4 w-4" />
                    GitHub Repository
                  </a>
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
