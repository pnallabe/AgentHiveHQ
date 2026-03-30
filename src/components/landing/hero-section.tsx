"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight } from "lucide-react";
import { fadeInUp, fadeInDown, fadeIn } from "@/lib/animations";

// ── Metric ticker data ───────────────────────────────────────────────────────

const TICKER_ITEMS = [
  { label: "Avg Decision Time",  value: "340ms"        },
  { label: "Approval Rate",      value: "71.3%"        },
  { label: "Decisions Today",    value: "1,247"        },
  { label: "Model AUC",          value: "0.847"        },
  { label: "Bias Flags",         value: "0 active"     },
  { label: "Rules Evaluated",    value: "4 per req"    },
  { label: "P99 Latency",        value: "480ms"        },
  { label: "Uptime",             value: "99.97%"       },
];

// Doubled so CSS loop scrolls seamlessly
const TICKER_DOUBLED = [...TICKER_ITEMS, ...TICKER_ITEMS];

// ── Component ────────────────────────────────────────────────────────────────

export function HeroSection() {
  const prefersReduced = useReducedMotion();

  const MotionDiv = motion.div;

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-surface-base"
      style={{ minHeight: "90vh" }}
    >
      {/* Radial gradient mesh behind headline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(51,102,244,0.15), transparent)",
        }}
      />

      {/* Dot-grid SVG overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #27272a 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex min-h-[90vh] flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mx-auto max-w-4xl">

          {/* Tag pill */}
          <MotionDiv
            variants={fadeInDown}
            initial={prefersReduced ? "visible" : "hidden"}
            animate="visible"
            style={{ transitionDelay: prefersReduced ? "0ms" : "0ms" }}
          >
            <span className="inline-block rounded-full border border-brand-700 bg-brand-950 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-brand-300">
              AI Credit Infrastructure
            </span>
          </MotionDiv>

          {/* H1 */}
          <MotionDiv
            variants={fadeInUp}
            initial={prefersReduced ? "visible" : "hidden"}
            animate="visible"
            style={{ transitionDelay: prefersReduced ? "0ms" : "0.1s" }}
          >
            <h1 className="mt-6 font-heading text-5xl font-bold tracking-tight text-zinc-50 sm:text-6xl md:text-7xl">
              Credit Decisioning
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
                Built for Scale.
              </span>
            </h1>
          </MotionDiv>

          {/* Subheading */}
          <MotionDiv
            variants={fadeInUp}
            initial={prefersReduced ? "visible" : "hidden"}
            animate="visible"
            style={{ transitionDelay: prefersReduced ? "0ms" : "0.2s" }}
          >
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              AI underwriting, SHAP explainability, and governance — production-ready
              for lenders who can&apos;t afford guesswork.
            </p>
          </MotionDiv>

          {/* CTA row */}
          <MotionDiv
            variants={fadeInUp}
            initial={prefersReduced ? "visible" : "hidden"}
            animate="visible"
            style={{ transitionDelay: prefersReduced ? "0ms" : "0.3s" }}
          >
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-11 bg-brand-500 px-6 text-white hover:bg-brand-600 focus-visible:ring-brand-500"
              >
                <Link href="/lab">
                  Try Product Lab
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 border-surface-border text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
              >
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>
          </MotionDiv>

          {/* Trust bar */}
          <MotionDiv
            variants={fadeIn}
            initial={prefersReduced ? "visible" : "hidden"}
            animate="visible"
            style={{ transitionDelay: prefersReduced ? "0ms" : "0.5s" }}
          >
            <p className="mt-8 font-mono text-xs text-zinc-600">
              Designed for institutions operating under SR 11-7 · FCRA §615 · CFPB guidance
            </p>
          </MotionDiv>
        </div>

        {/* Dashboard preview illustration */}
        <MotionDiv
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          animate="visible"
          style={{ transitionDelay: prefersReduced ? "0ms" : "0.65s" }}
          className="mt-16 w-full max-w-5xl px-4"
        >
          <div className="relative mx-auto overflow-hidden rounded-2xl border border-surface-border shadow-2xl shadow-brand-900/20">
            <Image
              src="/images/dashboard-preview.svg"
              alt="AgentHive underwriting dashboard showing approved decision, risk score 0.76, and SHAP feature importance chart"
              width={900}
              height={480}
              priority
              className="w-full h-auto"
              style={{ display: "block" }}
            />
            {/* Scanline gloss overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 60%)",
              }}
            />
          </div>
        </MotionDiv>
      </div>

      {/* Metric ticker strip */}
      <div
        className="relative border-y border-surface-border bg-surface-raised py-3 overflow-hidden"
        aria-label="Platform metrics"
        role="marquee"
      >
        <div className="ticker-track flex items-center gap-12 whitespace-nowrap">
          {TICKER_DOUBLED.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 font-mono text-xs text-zinc-500">
              <span className="text-zinc-600">「</span>
              <span>{item.label}:</span>
              <span className="text-zinc-300 font-medium">{item.value}</span>
              <span className="text-zinc-600">」</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

