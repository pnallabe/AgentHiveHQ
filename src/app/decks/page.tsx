'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Users, TrendingUp, ChevronLeft } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function DeckIndexPage() {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center bg-[#05050A] overflow-hidden"
      style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(51,102,244,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(51,102,244,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[400px] bg-brand-500/6 rounded-full blur-[130px] pointer-events-none" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center px-6 max-w-3xl"
      >
        {/* Back */}
        <motion.div variants={fadeUp} className="mb-8 flex justify-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            <ChevronLeft size={14} /> Back to platform
          </Link>
        </motion.div>

        <motion.div variants={fadeUp} className="mb-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/8 text-brand-300 text-xs font-semibold uppercase tracking-widest">
            ILOL · Pitch Decks
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-heading font-bold text-5xl md:text-6xl leading-tight tracking-tight text-white mb-3"
        >
          Choose Your Deck
        </motion.h1>
        <motion.p variants={fadeUp} className="text-zinc-500 text-lg mb-12">
          Two audiences. Two narratives. One platform.
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Deck */}
          <motion.div variants={fadeUp}>
            <Link href="/user-deck" className="group block">
              <div className="rounded-2xl border border-brand-500/20 bg-white/[0.02] hover:bg-brand-500/5 p-8 transition-all hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/10 text-left">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-5">
                  <Users size={22} />
                </div>
                <div className="font-heading font-bold text-white text-2xl mb-2">Customer Deck</div>
                <div className="text-zinc-500 text-sm mb-1">10 slides</div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                  Drive demo requests and product adoption. Built for compliance officers, risk analysts,
                  and CROs evaluating ILOL for their institution.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {['Problem', 'Product Demo', 'Modules', 'Value Prop', 'CTA'].map((t) => (
                    <span key={t} className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-[11px] text-zinc-500">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-brand-400 group-hover:text-brand-300 font-semibold text-sm transition-colors">
                  Open Deck <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Investor Deck */}
          <motion.div variants={fadeUp}>
            <Link href="/investor-deck" className="group block">
              <div className="rounded-2xl border border-violet-500/20 bg-white/[0.02] hover:bg-violet-500/5 p-8 transition-all hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10 text-left">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-5">
                  <TrendingUp size={22} />
                </div>
                <div className="font-heading font-bold text-white text-2xl mb-2">Investor Deck</div>
                <div className="text-zinc-500 text-sm mb-1">14 slides</div>
                <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                  Raise capital and show scale + defensibility. Built for VCs and strategic investors
                  evaluating the ILOL opportunity.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {['Market Size', 'Architecture', 'Why Now', 'Moat', 'Financials', 'Ask'].map((t) => (
                    <span key={t} className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/8 text-[11px] text-zinc-500">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-violet-400 group-hover:text-violet-300 font-semibold text-sm transition-colors">
                  Open Deck <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* Tips */}
        <motion.div variants={fadeUp} className="mt-10 text-center">
          <p className="text-zinc-700 text-xs">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-500 font-mono text-[10px]">← →</kbd> to navigate slides &nbsp;·&nbsp;
            Click <span className="text-zinc-500">Export PDF</span> to print any deck
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
