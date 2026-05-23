'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  SlideShell, SlideTitle, SlideSubtitle, SlideBadge, StatCard,
  GlassCard, BulletRow, Divider, GradientText, fadeUp, stagger,
} from '../SlideShell';
import { DecisionCommandCenter, PortfolioDashboard, ExamPacketUI, FairnessGauge, ModelPerformanceCard } from '../MockUI';
import {
  AlertTriangle, FileX, Eye, Clock, Layers, Zap, Shield, BarChart2,
  CheckCircle, ArrowRight, Activity, Database, Lock, TrendingDown, Users,
} from 'lucide-react';

// ── Slide 1 — Cover ───────────────────────────────────────────────────────
export function UserCover() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#05050A]">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(51,102,244,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(51,102,244,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center px-8 max-w-4xl"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/8 text-brand-300 text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Integrated Lending Operating Layer
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-heading font-bold text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6"
        >
          <GradientText gradient="blue-cyan">Credit Risk</GradientText>
          <br />
          <span className="text-white">Command Center.</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="text-zinc-400 text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed">
          Decide. Monitor. Explain. Comply.{' '}
          <span className="text-zinc-300">The single operating layer for every credit decision you make.</span>
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
          <button className="px-8 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-500/20 hover:shadow-brand-400/30">
            Book a Demo →
          </button>
          <button className="px-8 py-3.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white font-semibold text-sm transition-all">
            Explore Platform
          </button>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-12 flex items-center justify-center gap-8 text-xs text-zinc-600"
        >
          {['SOC 2 Type II', 'ECOA / Reg B Aligned', 'SR 11-7 Ready', '< 200ms Decisions'].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <CheckCircle size={11} className="text-brand-500" />
              {t}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Slide 2 — Problem ─────────────────────────────────────────────────────
export function UserProblem() {
  const problems = [
    {
      icon: <FileX size={18} />,
      label: 'Disconnected decisioning',
      sub: 'Policy engines, manual score overrides, zero audit trail — scattered across 4+ systems',
    },
    {
      icon: <Eye size={18} />,
      label: 'Blind portfolio monitoring',
      sub: 'Lagged reporting 30–90 days. You find out about risk deterioration after it is too late',
    },
    {
      icon: <Clock size={18} />,
      label: 'Compliance is a crisis',
      sub: '$500K–$5M in manual exam prep costs. Every OCC examination feels like an emergency',
    },
    {
      icon: <AlertTriangle size={18} />,
      label: 'Explainability gap',
      sub: 'Regulators, loan officers, and borrowers all ask "why." You have no defensible answer',
    },
  ];
  return (
    <SlideShell>
      <SlideBadge color="rose">The Problem</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          Mid-market lenders are flying blind<br />
          <GradientText gradient="blue-purple">at exactly the wrong moment.</GradientText>
        </SlideTitle>
      </div>
      <Divider />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {problems.map((p) => (
          <BulletRow key={p.label} icon={p.icon} label={p.label} sub={p.sub} />
        ))}
      </div>
      <motion.div
        variants={fadeUp}
        className="mt-6 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-300"
      >
        💬 <em>"We pull data from 4 systems into Excel every morning just to know what happened yesterday."</em>
        <span className="text-rose-500 ml-2">— Senior Risk Analyst, $800M Credit Union</span>
      </motion.div>
    </SlideShell>
  );
}

// ── Slide 3 — Pain (visceral) ─────────────────────────────────────────────
export function UserPain() {
  const pains = [
    { before: 'Excel risk reports', after: 'Real-time portfolio dashboard' },
    { before: '4-week fair lending prep', after: 'On-demand, in 30 seconds' },
    { before: 'Manual exam packet: 400+ hrs', after: 'One click, < 5 minutes' },
    { before: 'Unknown model drift for weeks', after: 'Daily performance monitoring' },
    { before: 'Overrides in email threads', after: 'Immutable override audit log' },
  ];
  return (
    <SlideShell>
      <SlideBadge color="rose">Current Reality</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          You are managing{' '}
          <GradientText gradient="blue-purple">billion-dollar risk</GradientText>
          <br />in spreadsheets.
        </SlideTitle>
      </div>
      <Divider />
      <div className="space-y-2.5 mt-2">
        {pains.map((p) => (
          <motion.div
            key={p.before}
            variants={fadeUp}
            className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="w-2 h-2 rounded-full bg-rose-500/60 flex-shrink-0" />
              <span className="text-sm text-zinc-500 line-through">{p.before}</span>
            </div>
            <ArrowRight size={14} className="text-zinc-700 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 flex-shrink-0" />
              <span className="text-sm text-emerald-300">{p.after}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 4 — Solution Overview ───────────────────────────────────────────
export function UserSolution() {
  return (
    <SlideShell>
      <SlideBadge color="blue">The Solution</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          One platform. Every credit decision.{' '}
          <GradientText gradient="blue-cyan">Fully governed.</GradientText>
        </SlideTitle>
      </div>
      <SlideSubtitle>
        ILOL is not a point solution. It is the connective tissue between every system and decision
        a lender makes — from application to examiner.
      </SlideSubtitle>
      <Divider />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
        {[
          { icon: <Zap size={20} />, title: 'Decide', sub: '< 200ms real-time decisions with full traceability' },
          { icon: <Activity size={20} />, title: 'Monitor', sub: 'Live portfolio health, delinquency, and alerts' },
          { icon: <Eye size={20} />, title: 'Explain', sub: 'SHAP-based reason codes, Reg B compliant' },
          { icon: <Shield size={20} />, title: 'Comply', sub: 'One-click exam packets, fair lending reports' },
        ].map((m) => (
          <GlassCard key={m.title} className="text-center">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 mx-auto mb-3">
              {m.icon}
            </div>
            <div className="font-heading font-bold text-white text-lg mb-1">{m.title}</div>
            <div className="text-xs text-zinc-500 leading-relaxed">{m.sub}</div>
          </GlassCard>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 5 — Product Demo ────────────────────────────────────────────────
export function UserProductDemo() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Live Platform</SlideBadge>
      <div className="mt-3 mb-4">
        <SlideTitle size="sm">
          The Decisioning Command Center.{' '}
          <GradientText gradient="blue-cyan">Real-time. Every decision.</GradientText>
        </SlideTitle>
      </div>
      <DecisionCommandCenter />
      <motion.div variants={fadeUp} className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
        {[
          { v: '< 200ms', l: 'p95 decision latency' },
          { v: '100%', l: 'decisions logged + explained' },
          { v: '7 yrs', l: 'immutable audit retention' },
        ].map((s) => (
          <div key={s.l} className="rounded-lg border border-white/6 bg-white/[0.02] py-2.5 px-3">
            <div className="text-brand-400 font-heading font-bold text-lg">{s.v}</div>
            <div className="text-zinc-500 text-[10px] mt-0.5">{s.l}</div>
          </div>
        ))}
      </motion.div>
    </SlideShell>
  );
}

// ── Slide 6 — Module Breakdown ────────────────────────────────────────────
export function UserModules() {
  const modules = [
    {
      name: 'Governance Infrastructure',
      color: 'blue' as const,
      icon: <Lock size={16} />,
      points: ['Immutable decision log', 'Policy versioning + rollback', 'Data lineage tracking'],
    },
    {
      name: 'Decisioning Engine',
      color: 'emerald' as const,
      icon: <Zap size={16} />,
      points: ['Rules + ML + scorecard orchestration', 'Bureau waterfall integration', 'Override workflow + dual approval'],
    },
    {
      name: 'Portfolio Monitoring',
      color: 'amber' as const,
      icon: <BarChart2 size={16} />,
      points: ['Real-time DPD, approval rate, charge-offs', 'Vintage cohort analysis', 'Intelligent alert thresholds'],
    },
    {
      name: 'Compliance & Audit',
      color: 'rose' as const,
      icon: <Shield size={16} />,
      points: ['One-click exam packet generation', 'Automated Reg B adverse action notices', 'Disparate impact monitoring (AIR)'],
    },
  ];
  return (
    <SlideShell>
      <SlideBadge color="blue">Platform Modules</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Adopt one module. Expand at will.{' '}
          <GradientText gradient="blue-cyan">Every piece connects.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {modules.map((m) => {
          const borderCls = {
            blue: 'border-brand-500/25', emerald: 'border-emerald-500/25',
            amber: 'border-amber-500/25', rose: 'border-rose-500/25',
          }[m.color];
          const iconCls = {
            blue: 'bg-brand-500/10 text-brand-400', emerald: 'bg-emerald-500/10 text-emerald-400',
            amber: 'bg-amber-500/10 text-amber-400', rose: 'bg-rose-500/10 text-rose-400',
          }[m.color];
          return (
            <motion.div
              key={m.name}
              variants={fadeUp}
              className={`rounded-xl border bg-white/[0.02] p-4 ${borderCls}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${iconCls}`}>
                {m.icon}
              </div>
              <div className="font-heading font-semibold text-white text-sm mb-2">{m.name}</div>
              <ul className="space-y-1">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-1.5 text-xs text-zinc-400">
                    <span className="text-brand-500 mt-0.5">·</span> {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </SlideShell>
  );
}

// ── Slide 7 — Differentiators ─────────────────────────────────────────────
export function UserDifferentiators() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Why ILOL</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Governance-first.{' '}
          <GradientText gradient="blue-cyan">Not bolted-on. Not an afterthought.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-2">
        {[
          {
            title: 'Regulator-Ready by Default',
            body: 'Every decision, policy change, and override is logged immutably with cryptographic hash chains. Exam packets generate in minutes, not months.',
            icon: <Shield size={22} className="text-brand-400" />,
          },
          {
            title: 'Explainability by Design',
            body: 'SHAP-based top-4 reason codes aligned to Reg B. Every declined applicant gets a defensible, auditable explanation — automatically.',
            icon: <Eye size={22} className="text-cyan-400" />,
          },
          {
            title: 'Modular. Start Anywhere.',
            body: 'Deploy compliance only. Or decisioning first. Or monitoring. Modules share data primitives — no reconciliation, no silos.',
            icon: <Layers size={22} className="text-violet-400" />,
          },
        ].map((d) => (
          <GlassCard key={d.title}>
            <div className="mb-3">{d.icon}</div>
            <div className="font-heading font-bold text-white text-base mb-2">{d.title}</div>
            <div className="text-xs text-zinc-400 leading-relaxed">{d.body}</div>
          </GlassCard>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 8 — Use Cases ───────────────────────────────────────────────────
export function UserUseCases() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Who Uses ILOL</SlideBadge>
      <div className="mt-4 mb-5">
        <SlideTitle size="sm">
          Built for the teams that own{' '}
          <GradientText gradient="blue-cyan">credit risk outcomes.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            persona: 'Risk Analysts',
            org: 'Credit Unions · $100M–$2B AUM',
            icon: <BarChart2 size={18} />,
            color: 'blue' as const,
            wins: [
              'Live portfolio metrics — no more Excel pulls',
              'Policy simulation before changes go live',
              'Fair lending reports in 30 seconds',
            ],
          },
          {
            persona: 'Chief Risk Officers',
            org: 'Fintech Lenders · $2B+ AUM',
            icon: <TrendingDown size={18} />,
            color: 'emerald' as const,
            wins: [
              'AI-generated board summaries (weekly)',
              'Real-time alerts on DPD and approval shifts',
              'Exam packet auto-generation',
            ],
          },
          {
            persona: 'Compliance Officers',
            org: 'Community Banks · Any size',
            icon: <Shield size={18} />,
            color: 'rose' as const,
            wins: [
              'Immutable audit trail for every decision',
              'Automated Reg B adverse action notices',
              'One-click OCC / CFPB exam packets',
            ],
          },
        ].map((uc) => {
          const borderCls = {
            blue: 'border-brand-500/20', emerald: 'border-emerald-500/20', rose: 'border-rose-500/20',
          }[uc.color];
          const iconCls = {
            blue: 'bg-brand-500/10 text-brand-400', emerald: 'bg-emerald-500/10 text-emerald-400',
            rose: 'bg-rose-500/10 text-rose-400',
          }[uc.color];
          return (
            <motion.div key={uc.persona} variants={fadeUp} className={`rounded-xl border bg-white/[0.02] p-5 ${borderCls}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconCls}`}>{uc.icon}</div>
              <div className="font-heading font-bold text-white text-base">{uc.persona}</div>
              <div className="text-xs text-zinc-600 mb-3">{uc.org}</div>
              <ul className="space-y-1.5">
                {uc.wins.map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-xs text-zinc-400">
                    <CheckCircle size={11} className="text-brand-500 mt-0.5 flex-shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </SlideShell>
  );
}

// ── Slide 9 — Value Proposition ───────────────────────────────────────────
export function UserValueProp() {
  return (
    <SlideShell>
      <SlideBadge color="emerald">Outcomes</SlideBadge>
      <div className="mt-4 mb-6">
        <SlideTitle size="sm">
          Measurable impact.{' '}
          <GradientText gradient="green-cyan">From day one.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard value="< 5 min" label="Exam packet generation" trend="Was: 4–8 weeks" color="blue" />
        <StatCard value="< 3 days" label="Policy change cycle time" trend="Was: 2–4 weeks" color="emerald" />
        <StatCard value="< 3 days" label="Model drift detection" trend="Was: 30–90 days" color="blue" />
        <StatCard value="0.1%" label="Adverse action error rate" trend="Was: 2–5%" color="emerald" />
        <StatCard value="95%" label="Exam prep cost reduction" trend="400+ hrs → < 20 hrs" color="blue" />
        <StatCard value="On-demand" label="Fair lending analysis" trend="Was: $30K consultant" color="emerald" />
      </div>
    </SlideShell>
  );
}

// ── Slide 10 — CTA ────────────────────────────────────────────────────────
export function UserCTA() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#05050A]">
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(51,102,244,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(51,102,244,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/8 rounded-full blur-[100px] pointer-events-none" />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center px-8 max-w-3xl"
      >
        <motion.div variants={fadeUp} className="mb-5">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/8 text-emerald-300 text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ready in Days, Not Months
          </span>
        </motion.div>

        <SlideTitle size="lg">
          Be audit-ready in{' '}
          <GradientText gradient="green-cyan">30 days.</GradientText>
        </SlideTitle>

        <motion.p variants={fadeUp} className="text-zinc-400 text-lg mt-4 mb-8 max-w-xl mx-auto">
          Plug in your data. Activate your policy. Your first exam packet is live before your next board meeting.
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
          <button className="px-10 py-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-base transition-all shadow-lg shadow-brand-500/25 hover:shadow-brand-400/30 flex items-center gap-2">
            Book a Demo <ArrowRight size={18} />
          </button>
          <button className="px-10 py-4 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white font-semibold transition-all">
            Explore Pricing
          </button>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-10 grid grid-cols-3 gap-4 text-center">
          {[
            { v: '< 30 days', l: 'time to first value' },
            { v: '3 LOS', l: 'connectors from day one' },
            { v: '7-year', l: 'immutable audit retention' },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-brand-400 font-heading font-bold text-xl">{s.v}</div>
              <div className="text-zinc-600 text-xs mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
