"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { fadeInUp, defaultViewport } from "@/lib/animations";
import { ArrowRight, BookOpen } from "lucide-react";

// ── Config ──────────────────────────────────────────────────────────────────
const DEMO_BOOKING_URL = "https://calendly.com/agenthivehq/demo";

export function ContactSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section id="contact" className="bg-surface-base px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        {/* Detached card */}
        <motion.div
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
          className="rounded-t-3xl border border-brand-800 bg-brand-950 px-8 py-16 text-center"
        >
          <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
            Ready to modernise your credit stack?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Book a 30-minute technical demo with our team. We&apos;ll walk through
            the underwriting pipeline, live SHAP explanations, and governance dashboard
            using your data or ours.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-11 bg-brand-500 px-6 text-white hover:bg-brand-600 focus-visible:ring-brand-500"
            >
              <a href={DEMO_BOOKING_URL}>
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 border-brand-700 text-zinc-300 hover:bg-brand-900/50 hover:text-zinc-100"
            >
              <Link href="/lab">
                <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                Try Product Lab
              </Link>
            </Button>
          </div>
          <p className="mt-4 font-mono text-xs text-zinc-600">
            No commitment. Demo uses real synthetic data. Set up in under 5 minutes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

