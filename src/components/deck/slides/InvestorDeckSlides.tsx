'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import {
  SlideShell, SlideTitle, SlideSubtitle, SlideBadge, StatCard,
  GlassCard, Divider, GradientText, fadeUp, fadeIn, stagger, Tag,
} from '../SlideShell';
import { PortfolioDashboard, ExamPacketUI, FairnessGauge, ModelPerformanceCard } from '../MockUI';
import {
  TrendingUp, Shield, Zap, Globe, DollarSign, Users, Target, ArrowRight,
  CheckCircle, Layers, Database, Lock, BarChart2, Activity, Clock, Star,
} from 'lucide-react';

// ARR projection data
const arrData = [
  { y: 'Y1', arr: 3 }, { y: 'Y2', arr: 10 }, { y: 'Y3', arr: 22 }, { y: 'Y4', arr: 45 },
];
const customerData = [
  { y: 'Y1', c: 20 }, { y: 'Y2', c: 62 }, { y: 'Y3', c: 140 }, { y: 'Y4', c: 280 },
];

// ── Slide 1 — Investor Cover ──────────────────────────────────────────────
export function InvestorCover() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#05050A]">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(51,102,244,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(51,102,244,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-brand-500/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-violet-500/6 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 text-center px-8 max-w-4xl"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/8 text-violet-300 text-xs font-semibold uppercase tracking-widest">
            Series Seed · Confidential
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="font-heading font-bold text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-6"
        >
          <span className="text-white">The Operating System</span>
          <br />
          <GradientText gradient="blue-purple">for Credit Risk.</GradientText>
        </motion.h1>

        <motion.p variants={fadeUp} className="text-zinc-400 text-xl md:text-2xl mb-10 max-w-2xl mx-auto">
          4,700 mid-market lenders. Zero purpose-built governance infrastructure.{' '}
          <span className="text-zinc-300">Until now.</span>
        </motion.p>

        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-6 max-w-xl mx-auto text-center">
          {[
            { v: '$12B+', l: 'TAM (US mid-market)' },
            { v: '4,700', l: 'addressable institutions' },
            { v: '$150K+', l: 'ARR per customer' },
          ].map((s) => (
            <div key={s.l} className="border border-white/8 rounded-xl py-4 bg-white/[0.02]">
              <div className="text-2xl font-heading font-bold text-brand-400">{s.v}</div>
              <div className="text-xs text-zinc-600 mt-1">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Slide 2 — Market Opportunity ──────────────────────────────────────────
export function InvestorMarket() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Market Opportunity</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          A massive, underserved market{' '}
          <GradientText gradient="blue-cyan">at an inflection point.</GradientText>
        </SlideTitle>
      </div>
      <Divider />
      <div className="grid grid-cols-2 gap-8 mt-2">
        <div className="space-y-4">
          {[
            { label: 'Total Addressable Market', value: '~$12B+', sub: 'US credit risk infrastructure + compliance tooling', color: 'blue' as const },
            { label: 'Serviceable Market (mid-market)', value: '~$2.8B', sub: '4,700 credit unions + community banks + fintech lenders', color: 'emerald' as const },
            { label: 'Initial Target (Year 1–2)', value: '~$750M', sub: 'Credit unions $100M–$2B AUM + fintech lenders', color: 'amber' as const },
          ].map((m) => (
            <StatCard key={m.label} value={m.value} label={m.label} trend={m.sub} color={m.color} />
          ))}
        </div>
        <div className="space-y-4">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Tailwinds Driving Demand</div>
            {[
              'CFPB intensifying fair lending enforcement (2024–2026)',
              'OCC SR 11-7 model risk MRAs surging at mid-market banks',
              'AI adoption requiring new model governance infrastructure',
              'Post-SVB regulatory scrutiny raising compliance bar for all lenders',
              'Legacy LOS vendors unable to deliver governance primitives',
            ].map((t) => (
              <div key={t} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs text-zinc-400">
                <TrendingUp size={11} className="text-brand-400 mt-0.5 flex-shrink-0" /> {t}
              </div>
            ))}
          </GlassCard>
        </div>
      </div>
    </SlideShell>
  );
}

// ── Slide 3 — Problem (Industry-Level) ───────────────────────────────────
export function InvestorProblem() {
  const matrix = [
    { d: 'Decisioning', pain: 'Disconnected policy engines, manual overrides, no audit trail', cost: 'High error rate + fair lending exposure' },
    { d: 'Monitoring', pain: 'Lagged reporting (30–90 days), no real-time portfolio visibility', cost: 'Slow response to credit deterioration' },
    { d: 'Compliance', pain: 'Manual exam prep, inconsistent docs, long audit cycles', cost: '$500K–$5M per examination cycle' },
  ];
  return (
    <SlideShell>
      <SlideBadge color="rose">Problem</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          Mid-market lenders face a{' '}
          <GradientText gradient="blue-purple">structural crisis.</GradientText>
        </SlideTitle>
      </div>
      <Divider />
      <div className="mt-3 rounded-xl border border-white/8 overflow-hidden">
        <div className="grid grid-cols-3 text-[11px] text-zinc-600 uppercase tracking-widest px-5 py-2.5 border-b border-white/5 bg-white/[0.02]">
          <span>Dimension</span><span>Current Pain</span><span>Cost</span>
        </div>
        {matrix.map((r, i) => (
          <motion.div
            key={r.d}
            variants={fadeUp}
            className={`grid grid-cols-3 px-5 py-3.5 border-b border-white/5 last:border-0 text-sm ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
          >
            <span className="font-semibold text-white">{r.d}</span>
            <span className="text-zinc-400 pr-4">{r.pain}</span>
            <span className="text-rose-400">{r.cost}</span>
          </motion.div>
        ))}
      </div>
      <motion.div variants={fadeUp} className="mt-5 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-sm text-rose-300">
        💬 <em>"Existing solutions address one or two of these pain points in isolation. No platform addresses all three in a unified, integrated layer."</em>
      </motion.div>
    </SlideShell>
  );
}

// ── Slide 4 — Solution (Platform Vision) ─────────────────────────────────
export function InvestorSolution() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Solution</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          Governance as a{' '}
          <GradientText gradient="blue-cyan">first-class engineering primitive.</GradientText>
        </SlideTitle>
      </div>
      <SlideSubtitle>
        ILOL is the connective tissue between every system and decision a lender makes —
        from the moment an application arrives to the moment a regulator walks in.
      </SlideSubtitle>
      <Divider />
      <div className="grid grid-cols-4 gap-3 mt-3">
        {[
          { name: 'Governance-Native Risk Infra', tag: 'GNRI', icon: <Lock size={16} />, color: 'text-brand-400' },
          { name: 'Decisioning Engine', tag: '< 200ms', icon: <Zap size={16} />, color: 'text-cyan-400' },
          { name: 'Portfolio Monitoring', tag: 'Real-time', icon: <Activity size={16} />, color: 'text-emerald-400' },
          { name: 'Compliance & Audit', tag: '1-click', icon: <Shield size={16} />, color: 'text-violet-400' },
          { name: 'Model Lifecycle Mgmt', tag: 'SR 11-7', icon: <Database size={16} />, color: 'text-amber-400' },
          { name: 'Model Explainability', tag: 'SHAP/LIME', icon: <BarChart2 size={16} />, color: 'text-rose-400' },
          { name: 'A/B Testing Framework', tag: 'Phase 3', icon: <Target size={16} />, color: 'text-teal-400' },
          { name: 'NLG Executive Reports', tag: 'GPT-4o', icon: <Star size={16} />, color: 'text-fuchsia-400' },
        ].map((m) => (
          <motion.div
            key={m.name}
            variants={fadeUp}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex flex-col gap-2"
          >
            <div className={`${m.color}`}>{m.icon}</div>
            <div className="text-xs font-semibold text-zinc-200 leading-snug">{m.name}</div>
            <Tag>{m.tag}</Tag>
          </motion.div>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 5 — Architecture ────────────────────────────────────────────────
export function InvestorArchitecture() {
  const layers = [
    { label: 'API Gateway', tech: 'AWS API Gateway + Kong', detail: 'Auth, rate limiting, tenant routing' },
    { label: 'Microservices', tech: 'FastAPI (Python) + Go', detail: '6 independent services, EKS-deployed' },
    { label: 'Event Bus', tech: 'Apache Kafka (MSK)', detail: 'High-throughput, durable, replayable' },
    { label: 'Audit Store', tech: 'Amazon QLDB', detail: 'Cryptographically verifiable, append-only' },
    { label: 'Analytics', tech: 'Snowflake / BigQuery', detail: 'Portfolio analytics, SQL-first' },
    { label: 'Model Serving', tech: 'BentoML / SageMaker', detail: 'Versioned endpoints, rollback-capable' },
  ];
  return (
    <SlideShell>
      <SlideBadge color="blue">Architecture</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Modular microservices.{' '}
          <GradientText gradient="blue-cyan">Multi-tenant. Governance-native.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {layers.map((l) => (
            <motion.div key={l.label} variants={fadeUp} className="flex items-center gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-4 py-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-brand-400 text-[10px] font-bold">{l.label[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-zinc-200">{l.label}</span>
                <span className="text-zinc-700 mx-1.5">·</span>
                <Tag>{l.tech}</Tag>
              </div>
              <span className="text-[10px] text-zinc-600 hidden md:block text-right">{l.detail}</span>
            </motion.div>
          ))}
        </div>
        <div className="space-y-3">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Multi-Tenant Isolation</div>
            {[
              'Database-per-tenant on RDS (full data isolation)',
              'Row-level security + tenant JWT context',
              'Automated isolation test suite on every deploy',
              'Self-service provisioning in < 4 hours',
            ].map((t) => (
              <div key={t} className="flex items-start gap-2 py-1 border-b border-white/5 last:border-0 text-xs text-zinc-400">
                <CheckCircle size={10} className="text-emerald-400 mt-0.5 flex-shrink-0" /> {t}
              </div>
            ))}
          </GlassCard>
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Decisioning Latency Budget</div>
            <div className="space-y-1">
              {[
                ['Auth + Rate Limit', '5ms'],
                ['Feature Resolution', '10ms'],
                ['Bureau Pull (cached)', '30ms'],
                ['Model Scoring', '20ms'],
                ['Policy Evaluation', '15ms'],
                ['Explainability', '10ms'],
              ].map(([step, time]) => (
                <div key={step} className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">{step}</span>
                  <span className="text-brand-400 font-mono">{time}</span>
                </div>
              ))}
              <div className="flex justify-between text-[11px] border-t border-white/10 pt-1 mt-1">
                <span className="text-zinc-300 font-semibold">Total (p95)</span>
                <span className="text-emerald-400 font-mono font-bold">~90–140ms</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </SlideShell>
  );
}

// ── Slide 6 — Why Now ─────────────────────────────────────────────────────
export function InvestorWhyNow() {
  return (
    <SlideShell>
      <SlideBadge color="amber">Why Now</SlideBadge>
      <div className="mt-4 mb-2">
        <SlideTitle size="md">
          Three forces converging.{' '}
          <GradientText gradient="blue-cyan">Right now.</GradientText>
        </SlideTitle>
      </div>
      <Divider />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        {[
          {
            num: '01',
            title: 'Regulatory Reckoning',
            body: 'CFPB under new leadership is intensifying fair lending enforcement. OCC is issuing SR 11-7 MRAs at record pace. Mid-market lenders cannot absorb manual exam costs any longer.',
            color: 'text-amber-400',
            border: 'border-amber-500/20',
          },
          {
            num: '02',
            title: 'AI Adoption Demands Governance',
            body: 'Every lender deploying ML models now faces model risk management obligations. The infrastructure to govern AI credit decisions does not exist at mid-market scale.',
            color: 'text-brand-400',
            border: 'border-brand-500/20',
          },
          {
            num: '03',
            title: 'Fintech Maturity',
            body: 'First-generation fintech lenders are scaling past $500M AUM. They are hitting institutional compliance requirements without institutional infrastructure. They need ILOL.',
            color: 'text-violet-400',
            border: 'border-violet-500/20',
          },
        ].map((w) => (
          <motion.div key={w.num} variants={fadeUp} className={`rounded-xl border bg-white/[0.02] p-5 ${w.border}`}>
            <div className={`text-4xl font-heading font-bold mb-3 ${w.color} opacity-40`}>{w.num}</div>
            <div className="font-heading font-bold text-white text-base mb-2">{w.title}</div>
            <div className="text-xs text-zinc-400 leading-relaxed">{w.body}</div>
          </motion.div>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 7 — Business Model ──────────────────────────────────────────────
export function InvestorBusinessModel() {
  return (
    <SlideShell>
      <SlideBadge color="emerald">Business Model</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          SaaS. Modular adoption.{' '}
          <GradientText gradient="green-cyan">Expanding revenue per customer.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          {[
            {
              tier: 'Starter',
              arr: '$150K / yr',
              modules: 'Governance Core + Decisioning API',
              target: 'Credit unions, $100M–$500M AUM',
              color: 'border-zinc-700',
            },
            {
              tier: 'Growth',
              arr: '$300K / yr',
              modules: '+ Portfolio Monitoring + Compliance Layer',
              target: 'Fintech lenders, $500M–$2B AUM',
              color: 'border-brand-500/30',
            },
            {
              tier: 'Enterprise',
              arr: '$600K+ / yr',
              modules: '+ Model Lifecycle + A/B Testing + NLG',
              target: 'Credit unions $2B+, bank holding companies',
              color: 'border-violet-500/30',
            },
          ].map((t) => (
            <motion.div key={t.tier} variants={fadeUp} className={`rounded-xl border bg-white/[0.02] p-4 ${t.color}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-heading font-bold text-white">{t.tier}</span>
                <span className="text-emerald-400 font-bold font-heading text-sm">{t.arr}</span>
              </div>
              <div className="text-xs text-zinc-400 mb-1">{t.modules}</div>
              <div className="text-[11px] text-zinc-600">{t.target}</div>
            </motion.div>
          ))}
        </div>
        <div className="space-y-3">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Revenue Mechanics</div>
            {[
              { label: 'Annual contract minimum', value: '$150K' },
              { label: 'Average initial ACV', value: '$220K' },
              { label: 'Expansion rate (module add-ons)', value: '30–40% YoY' },
              { label: 'Target NRR at scale', value: '> 120%' },
              { label: 'Gross margin (SaaS at scale)', value: '72–78%' },
              { label: 'CAC payback period', value: '< 18 months' },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                <span className="text-zinc-400">{r.label}</span>
                <span className="text-emerald-400 font-semibold">{r.value}</span>
              </div>
            ))}
          </GlassCard>
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Add-On Revenue Streams</div>
            <div className="flex flex-wrap gap-1.5">
              {['Bureau API pass-through', 'Exam packet generation credits', 'Premium SLA', 'White-label / OEM (Phase 3)', 'Snowflake write connector'].map((a) => (
                <Tag key={a}>{a}</Tag>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </SlideShell>
  );
}

// ── Slide 8 — Traction ────────────────────────────────────────────────────
export function InvestorTraction() {
  return (
    <SlideShell>
      <SlideBadge color="emerald">Traction</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Design partners. Pipeline. Validation.{' '}
          <GradientText gradient="green-cyan">The signal is clear.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Design Partner Profile</div>
            {[
              { label: 'Active design partners', value: '[X] institutions' },
              { label: 'Average AUM', value: '$800M' },
              { label: 'Primary pain point', value: 'Exam prep + fair lending' },
              { label: 'Engagement depth', value: 'Weekly feedback sessions' },
              { label: 'LOI / committed', value: '[X] signed LOIs' },
            ].map((r) => (
              <div key={r.label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                <span className="text-zinc-400">{r.label}</span>
                <span className="text-brand-400 font-semibold">{r.value}</span>
              </div>
            ))}
          </GlassCard>
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Qualified Pipeline</div>
            <div className="text-3xl font-heading font-bold text-emerald-400 mb-1">$[X]M</div>
            <div className="text-xs text-zinc-500">ARR-equivalent in active sales conversations</div>
          </GlassCard>
        </div>
        <div className="space-y-4">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Use-Case Validation</div>
            {[
              'Exam packet generation → from 400 hrs to 4 mins (validated)',
              'Policy rollback with audit trail → 1-click in production',
              'SHAP reason codes → passed compliance review at 2 design partners',
              'Fair lending AIR monitoring → daily calculations, < 1s refresh',
              'Decision latency → 112ms p95 measured in staging with real bureau pull',
            ].map((v) => (
              <div key={v} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0 text-xs text-zinc-400">
                <CheckCircle size={10} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {v}
              </div>
            ))}
          </GlassCard>
        </div>
      </div>
    </SlideShell>
  );
}

// ── Slide 9 — Competitive Landscape ──────────────────────────────────────
export function InvestorCompetitive() {
  const grid = [
    { name: 'Zest AI',             ml: true,  gov: false, exam: false, rt: false, modular: false },
    { name: 'Provenir',            ml: false, gov: false, exam: false, rt: true,  modular: false },
    { name: 'Experian Ascend',     ml: false, gov: false, exam: false, rt: false, modular: false },
    { name: 'Abrigo / Sageworks',  ml: false, gov: false, exam: false, rt: false, modular: false },
    { name: 'In-house builds',     ml: true,  gov: false, exam: false, rt: false, modular: false },
    { name: 'ILOL',                ml: true,  gov: true,  exam: true,  rt: true,  modular: true  },
  ];
  const cols = ['ML Models', 'Governance Layer', 'Exam Automation', 'Real-time Decisions', 'Modular Adoption'];
  return (
    <SlideShell>
      <SlideBadge color="blue">Competitive Landscape</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Point solutions vs.{' '}
          <GradientText gradient="blue-cyan">a unified operating layer.</GradientText>
        </SlideTitle>
      </div>
      <div className="rounded-xl border border-white/8 overflow-hidden">
        {/* Header */}
        <div className="grid bg-white/[0.02] border-b border-white/5 text-[10px] text-zinc-600 uppercase tracking-widest">
          <div className="grid" style={{ gridTemplateColumns: '1.5fr repeat(5, 1fr)' }}>
            <div className="px-4 py-2.5">Vendor</div>
            {cols.map((c) => <div key={c} className="px-2 py-2.5 text-center">{c}</div>)}
          </div>
        </div>
        {grid.map((row, i) => {
          const isILOL = row.name === 'ILOL';
          return (
            <motion.div
              key={row.name}
              variants={fadeUp}
              className={`border-b border-white/5 last:border-0 ${isILOL ? 'bg-brand-500/8' : i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
            >
              <div className="grid" style={{ gridTemplateColumns: '1.5fr repeat(5, 1fr)' }}>
                <div className={`px-4 py-3 text-sm font-semibold ${isILOL ? 'text-brand-300' : 'text-zinc-400'}`}>
                  {row.name}
                  {isILOL && <span className="ml-2 text-[10px] text-brand-500">← only platform</span>}
                </div>
                {[row.ml, row.gov, row.exam, row.rt, row.modular].map((v, ci) => (
                  <div key={ci} className="flex items-center justify-center py-3">
                    {v ? (
                      <CheckCircle size={14} className={isILOL ? 'text-brand-400' : 'text-emerald-500'} />
                    ) : (
                      <span className="text-zinc-700 text-sm">—</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </SlideShell>
  );
}

// ── Slide 10 — Moat ───────────────────────────────────────────────────────
export function InvestorMoat() {
  return (
    <SlideShell>
      <SlideBadge color="violet">Defensibility</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          The moat is not the code.{' '}
          <GradientText gradient="blue-purple">It&apos;s the governance layer.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Embedded Compliance Workflows',
            body: 'Exam packets, adverse action notices, and fairness reports become the operational heartbeat of every compliance team. Switching means rebuilding institutional memory.',
            icon: <Lock size={20} />,
            color: 'border-brand-500/25 text-brand-400',
          },
          {
            title: 'Audit Data Network Effect',
            body: 'Every decision logged, every policy versioned, every model monitored creates compounding audit evidence that increases in value over time. 7+ years of data = irreplaceable.',
            icon: <Database size={20} />,
            color: 'border-violet-500/25 text-violet-400',
          },
          {
            title: 'Regulatory Alignment IP',
            body: 'OCC, CFPB, and SR 11-7 templates are built into the product architecture, not documentation. This requires deep regulatory expertise that cannot be commoditized quickly.',
            icon: <Shield size={20} />,
            color: 'border-emerald-500/25 text-emerald-400',
          },
          {
            title: 'LOS Integration Depth',
            body: 'Certified MeridianLink connector + SFTP fallback for all others. Each integration deepens with customer-specific field mappings, creating high switching costs.',
            icon: <Layers size={20} />,
            color: 'border-cyan-500/25 text-cyan-400',
          },
          {
            title: 'SR 11-7 Developer Brand',
            body: 'Data scientists and model risk teams recognize ILOL as their governance infrastructure. The platform becomes their career compliance tool, not just a vendor.',
            icon: <Users size={20} />,
            color: 'border-amber-500/25 text-amber-400',
          },
          {
            title: 'Multi-Tenant Data Flywheel',
            body: 'Aggregate (anonymized) portfolio and model performance benchmarks across the customer base create a proprietary risk intelligence feed unavailable to point solutions.',
            icon: <TrendingUp size={20} />,
            color: 'border-rose-500/25 text-rose-400',
          },
        ].map((m) => {
          const [border, textColor] = m.color.split(' ');
          return (
            <motion.div key={m.title} variants={fadeUp} className={`rounded-xl border bg-white/[0.02] p-4 ${border}`}>
              <div className={`mb-2 ${textColor}`}>{m.icon}</div>
              <div className="font-semibold text-white text-sm mb-1.5">{m.title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{m.body}</div>
            </motion.div>
          );
        })}
      </div>
    </SlideShell>
  );
}

// ── Slide 11 — GTM ────────────────────────────────────────────────────────
export function InvestorGTM() {
  return (
    <SlideShell>
      <SlideBadge color="blue">Go-To-Market</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Land on compliance pain.{' '}
          <GradientText gradient="blue-cyan">Expand on intelligence.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          {[
            {
              phase: 'Land (Phase 1)',
              title: 'Compliance-led entry',
              body: 'Compliance officer facing imminent OCC exam. Value prop: "Be audit-ready in 30 days." Low friction — governance core deploys in < 2 weeks.',
              color: 'border-brand-500/30',
            },
            {
              phase: 'Expand (Phase 2)',
              title: 'Risk team adoption',
              body: 'Portfolio monitoring + fairness dashboard unlocks risk analyst and CRO engagement. NLG summaries drive weekly board touchpoints.',
              color: 'border-emerald-500/30',
            },
            {
              phase: 'Scale (Phase 3)',
              title: 'Data science platform',
              body: 'Model registry + SR 11-7 automation locks in data science teams. A/B testing and multi-product policy engine expand seat count and ACV.',
              color: 'border-violet-500/30',
            },
          ].map((p) => (
            <motion.div key={p.phase} variants={fadeUp} className={`rounded-xl border bg-white/[0.02] p-4 ${p.color}`}>
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{p.phase}</div>
              <div className="font-semibold text-white text-sm mb-1.5">{p.title}</div>
              <div className="text-xs text-zinc-400">{p.body}</div>
            </motion.div>
          ))}
        </div>
        <div className="space-y-3">
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Channel Strategy</div>
            {[
              { ch: 'Direct outbound', detail: 'Compliance officers + CROs at target segment', pri: 'Primary' },
              { ch: 'LOS partner channel', detail: 'MeridianLink co-sell + marketplace listing', pri: 'Secondary' },
              { ch: 'CUNA / NAFCU', detail: 'Credit union industry association partnerships', pri: 'Secondary' },
              { ch: 'RegTech advisors', detail: 'Compliance consultants as referral partners', pri: 'Tertiary' },
            ].map((c) => (
              <div key={c.ch} className="flex items-start justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                <div>
                  <div className="text-zinc-300 font-medium">{c.ch}</div>
                  <div className="text-zinc-600">{c.detail}</div>
                </div>
                <Tag>{c.pri}</Tag>
              </div>
            ))}
          </GlassCard>
          <GlassCard>
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">ICP Definition</div>
            <div className="space-y-1 text-xs text-zinc-400">
              <div className="flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">·</span> Credit union or fintech lender</div>
              <div className="flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">·</span> $100M–$2B AUM</div>
              <div className="flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">·</span> OCC or CFPB examination in next 12 months</div>
              <div className="flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">·</span> Has deployed or plans ML-based underwriting</div>
              <div className="flex items-start gap-1.5"><span className="text-brand-400 mt-0.5">·</span> Dedicated compliance officer (decision maker)</div>
            </div>
          </GlassCard>
        </div>
      </div>
    </SlideShell>
  );
}

// ── Slide 12 — Financial Projections ──────────────────────────────────────
export function InvestorFinancials() {
  return (
    <SlideShell>
      <SlideBadge color="emerald">Projections</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Path to{' '}
          <GradientText gradient="green-cyan">$45M ARR by Year 4.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">ARR Trajectory ($M)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={arrData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="arr-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3366f4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3366f4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="y" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`$${v}M`, 'ARR']}
              />
              <Area type="monotone" dataKey="arr" stroke="#3366f4" strokeWidth={2} fill="url(#arr-g)" dot={{ fill: '#3366f4', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Customer Count</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={customerData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="y" tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
              />
              <Bar dataKey="c" radius={[4, 4, 0, 0]}>
                {customerData.map((_, i) => (
                  <Cell key={i} fill={i === customerData.length - 1 ? '#10b981' : '#064e3b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        {[
          { y: 'Y1', arr: '$3M', c: '20', nrr: '—' },
          { y: 'Y2', arr: '$10M', c: '62', nrr: '118%' },
          { y: 'Y3', arr: '$22M', c: '140', nrr: '122%' },
          { y: 'Y4', arr: '$45M', c: '280', nrr: '125%' },
        ].map((r) => (
          <motion.div key={r.y} variants={fadeUp} className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-center">
            <div className="text-xs text-zinc-600 mb-1">{r.y}</div>
            <div className="text-emerald-400 font-heading font-bold text-lg">{r.arr}</div>
            <div className="text-[10px] text-zinc-600">{r.c} customers</div>
            {r.nrr !== '—' && <div className="text-[10px] text-brand-400">{r.nrr} NRR</div>}
          </motion.div>
        ))}
      </div>
    </SlideShell>
  );
}

// ── Slide 13 — Team ───────────────────────────────────────────────────────
export function InvestorTeam() {
  const roles = [
    { role: 'CEO / Co-founder', name: '[Founder Name]', bg: 'Credit risk + fintech leadership', note: 'Previously: [Institution / Company]' },
    { role: 'CTO / Co-founder', name: '[Founder Name]', bg: 'ML infrastructure + distributed systems', note: 'Previously: [Institution / Company]' },
    { role: 'Head of Compliance', name: '[Name]', bg: 'OCC / CFPB regulatory background', note: 'Former examiner or RegTech leader' },
    { role: 'Head of Data Science', name: '[Name]', bg: 'Credit modeling + SR 11-7 governance', note: 'Prev: ML engineering @ [Company]' },
  ];
  const advisors = [
    'Former OCC Deputy Comptroller · Fair Lending',
    'Model Risk Sr. Advisor · SR 11-7 alignment',
    'Credit Union CEO · $1.8B AUM (design partner lens)',
    'Series A / Fintech VC (non-conflicted)',
  ];
  return (
    <SlideShell>
      <SlideBadge color="blue">Team</SlideBadge>
      <div className="mt-4 mb-4">
        <SlideTitle size="sm">
          Built by people who know{' '}
          <GradientText gradient="blue-cyan">what regulators actually ask for.</GradientText>
        </SlideTitle>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {roles.map((m) => (
          <motion.div key={m.role} variants={fadeUp} className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400 font-heading font-bold text-lg flex-shrink-0">
              {m.name.charAt(1)}
            </div>
            <div>
              <div className="text-xs text-zinc-600 uppercase tracking-widest">{m.role}</div>
              <div className="font-heading font-bold text-white text-sm mt-0.5">{m.name}</div>
              <div className="text-xs text-zinc-400 mt-1">{m.bg}</div>
              <div className="text-[11px] text-zinc-600 mt-0.5 italic">{m.note}</div>
            </div>
          </motion.div>
        ))}
      </div>
      <GlassCard>
        <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Advisory Board</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {advisors.map((a) => (
            <div key={a} className="flex items-start gap-1.5 text-xs text-zinc-400">
              <Star size={10} className="text-brand-500 mt-0.5 flex-shrink-0" /> {a}
            </div>
          ))}
        </div>
      </GlassCard>
    </SlideShell>
  );
}

// ── Slide 14 — Ask ────────────────────────────────────────────────────────
export function InvestorAsk() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#05050A]">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(51,102,244,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(51,102,244,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-brand-500/8 rounded-full blur-[130px] pointer-events-none" />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 px-8 max-w-4xl w-full"
      >
        <motion.div variants={fadeUp} className="text-center mb-8">
          <SlideBadge color="blue">The Ask</SlideBadge>
          <SlideTitle size="lg">
            <GradientText gradient="blue-purple">$[X]M Seed Round.</GradientText>
          </SlideTitle>
          <p className="text-zinc-400 text-lg mt-3">18 months to 15 paying customers and $3M+ ARR.</p>
        </motion.div>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Use of Funds</div>
            {[
              { label: 'Engineering (9 headcount → Y1)', pct: '55%', detail: '3 BE · 1 FE · 1 DE · 1 ML · 1 DevOps · 1 PM · 1 Compliance' },
              { label: 'GTM (direct sales + partnerships)', pct: '25%', detail: '2 enterprise AEs + SDR + partnerships' },
              { label: 'Infrastructure + Regulatory', pct: '12%', detail: 'Multi-region AWS, SOC 2 Type I, pen test' },
              { label: 'G&A + reserve', pct: '8%', detail: 'Legal, ops, 3-month buffer' },
            ].map((u) => (
              <motion.div key={u.label} variants={fadeUp} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-zinc-200">{u.label}</span>
                  <span className="text-brand-400 font-heading font-bold">{u.pct}</span>
                </div>
                <div className="text-[11px] text-zinc-600">{u.detail}</div>
              </motion.div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Seed Milestones (18 months)</div>
            {[
              { m: 'M4',  t: '3 paid pilot customers live' },
              { m: 'M6',  t: 'Phase 1 complete — exam packet + decisioning live' },
              { m: 'M10', t: '10 paying customers · $1.5M ARR' },
              { m: 'M12', t: 'Phase 2 complete — portfolio monitoring + fairness' },
              { m: 'M15', t: 'SOC 2 Type I certified' },
              { m: 'M18', t: '15–20 customers · $3M+ ARR · Series A ready' },
            ].map((s) => (
              <motion.div key={s.m} variants={fadeUp} className="flex items-center gap-3">
                <div className="w-10 h-6 rounded-md bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 text-[11px] font-bold flex-shrink-0">{s.m}</div>
                <span className="text-xs text-zinc-400">{s.t}</span>
              </motion.div>
            ))}
            <motion.div variants={fadeUp} className="mt-4 p-4 rounded-xl border border-brand-500/30 bg-brand-500/5 text-center">
              <div className="text-brand-300 font-heading font-bold text-xl mb-1">Series A Trigger</div>
              <div className="text-xs text-zinc-400">$3M+ ARR · 15+ customers · Phase 2 complete · NRR validation</div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
