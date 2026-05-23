'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { fadeUp } from './SlideShell';

// ── Mock data ─────────────────────────────────────────────────────────────
const vintageData = [
  { m: 'Jan', dpd: 1.2 }, { m: 'Feb', dpd: 1.5 }, { m: 'Mar', dpd: 1.8 },
  { m: 'Apr', dpd: 2.1 }, { m: 'May', dpd: 2.4 }, { m: 'Jun', dpd: 3.0 },
  { m: 'Jul', dpd: 3.4 }, { m: 'Aug', dpd: 3.9 }, { m: 'Sep', dpd: 4.2 },
];

const volumeData = [
  { m: 'J', v: 8.2 }, { m: 'F', v: 9.1 }, { m: 'M', v: 10.4 },
  { m: 'A', v: 11.8 }, { m: 'M', v: 10.9 }, { m: 'J', v: 12.4 },
];

const DECISIONS = [
  { id: 'APP-8821', outcome: 'APPROVED', amount: '$12,500', score: 742 },
  { id: 'APP-8820', outcome: 'DECLINED', amount: '—',       score: 591 },
  { id: 'APP-8819', outcome: 'APPROVED', amount: '$8,000',  score: 718 },
  { id: 'APP-8818', outcome: 'REFERRED', amount: '—',       score: 638 },
  { id: 'APP-8817', outcome: 'APPROVED', amount: '$15,000', score: 764 },
];

// ── DecisionCommandCenter ─────────────────────────────────────────────────
export function DecisionCommandCenter() {
  return (
    <motion.div
      variants={fadeUp}
      className="w-full rounded-2xl border border-white/8 bg-[#0C0C14] overflow-hidden text-xs font-mono shadow-2xl"
    >
      {/* Titlebar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111118] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-zinc-500 text-[10px]">ILOL · Decisioning Command Center</span>
      </div>

      {/* Top stats bar */}
      <div className="grid grid-cols-4 border-b border-white/5">
        {[
          { label: 'Today', val: '1,247', sub: 'applications' },
          { label: 'Approved', val: '72%', sub: 'approval rate', color: 'text-emerald-400' },
          { label: 'Declined', val: '21%', sub: 'decline rate', color: 'text-rose-400' },
          { label: 'Referred', val: '7%', sub: 'manual review', color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3 border-r border-white/5 last:border-0">
            <div className={`text-lg font-bold font-heading ${s.color ?? 'text-white'}`}>{s.val}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main pane */}
      <div className="grid grid-cols-2 divide-x divide-white/5" style={{ height: 200 }}>
        {/* Decision feed */}
        <div className="overflow-hidden">
          <div className="px-3 py-2 text-[10px] text-zinc-600 uppercase tracking-widest border-b border-white/5">Application Feed</div>
          {DECISIONS.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-center justify-between px-3 py-2 border-b border-white/[0.04] ${i === 1 ? 'bg-brand-500/5' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    d.outcome === 'APPROVED' ? 'bg-emerald-400' :
                    d.outcome === 'DECLINED' ? 'bg-rose-400' : 'bg-amber-400'
                  }`}
                />
                <span className="text-zinc-300">{d.id}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-600">score {d.score}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    d.outcome === 'APPROVED' ? 'text-emerald-400' :
                    d.outcome === 'DECLINED' ? 'text-rose-400' : 'text-amber-400'
                  }`}
                >
                  {d.outcome}
                </span>
                <span className="text-zinc-400 w-14 text-right">{d.amount}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Decision detail */}
        <div className="px-4 py-3">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-2">APP-8821 · Detail</div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-emerald-400 font-bold">APPROVED</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-300">Score 742</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 text-[10px]">Policy v2.4.1</span>
          </div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1.5">Top Factors (SHAP)</div>
          {[
            { f: 'Payment history', v: '+0.18', pos: true },
            { f: 'Utilization',     v: '+0.12', pos: true },
            { f: 'DTI ratio',       v: '−0.08', pos: false },
            { f: 'Account age',     v: '−0.04', pos: false },
          ].map((r) => (
            <div key={r.f} className="flex items-center justify-between py-0.5">
              <span className="text-zinc-400">{r.f}</span>
              <span className={`font-bold ${r.pos ? 'text-emerald-400' : 'text-rose-400'}`}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── PortfolioDashboard ─────────────────────────────────────────────────────
export function PortfolioDashboard() {
  return (
    <motion.div
      variants={fadeUp}
      className="w-full rounded-2xl border border-white/8 bg-[#0C0C14] overflow-hidden text-xs font-mono shadow-2xl"
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111118] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-zinc-500 text-[10px]">ILOL · Portfolio Monitoring</span>
        <span className="ml-auto flex items-center gap-1 text-amber-400 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          3 Active Alerts
        </span>
      </div>

      {/* KPI strips */}
      <div className="grid grid-cols-4 border-b border-white/5">
        {[
          { label: 'Originations MTD', val: '$12.4M', trend: '▲ +8%', tc: 'text-emerald-400' },
          { label: 'Approval Rate',    val: '71.3%',  trend: '▼ −220bps', tc: 'text-rose-400' },
          { label: '30+ DPD',          val: '4.2%',   trend: '▲ +67bps', tc: 'text-amber-400' },
          { label: 'Net Charge-Off',   val: '1.8%',   trend: '▼ −12bps', tc: 'text-emerald-400' },
        ].map((k) => (
          <div key={k.label} className="px-4 py-3 border-r border-white/5 last:border-0">
            <div className="text-lg font-bold font-heading text-white">{k.val}</div>
            <div className={`text-[10px] ${k.tc}`}>{k.trend}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 divide-x divide-white/5" style={{ height: 160 }}>
        <div>
          <div className="px-3 pt-2 text-[10px] text-zinc-600 uppercase tracking-widest">DPD Trend (9mo)</div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={vintageData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dpd-g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 10 }}
                itemStyle={{ color: '#fbbf24' }}
              />
              <Area type="monotone" dataKey="dpd" stroke="#f59e0b" strokeWidth={1.5} fill="url(#dpd-g)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <div className="px-3 pt-2 text-[10px] text-zinc-600 uppercase tracking-widest">Originations Volume ($M)</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={volumeData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <XAxis dataKey="m" tick={{ fontSize: 9, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#52525b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 10 }}
                itemStyle={{ color: '#3366f4' }}
              />
              <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                {volumeData.map((_, i) => (
                  <Cell key={i} fill={i === volumeData.length - 1 ? '#3366f4' : '#1d3a8a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}

// ── ExamPacketUI ──────────────────────────────────────────────────────────
export function ExamPacketUI() {
  const items = [
    { label: 'Policy Version History',    detail: 'v2.2.0 – v2.4.1 · 3 versions', checked: true },
    { label: 'Decision Log Summary',      detail: '47,821 decisions',               checked: true },
    { label: 'Override Log',              detail: '142 overrides · 98% approved',   checked: true },
    { label: 'Fair Lending Analysis',     detail: 'AIR 0.87 · Race/Ethnicity',      checked: true },
    { label: 'Adverse Action Summary',    detail: '11,203 declines · 100% AA sent', checked: true },
    { label: 'Model Validation Summary',  detail: 'AUC 0.742 · last validated Feb', checked: true },
    { label: 'Data Lineage Evidence',     detail: 'Full feature provenance',        checked: false },
  ];
  return (
    <motion.div
      variants={fadeUp}
      className="w-full rounded-2xl border border-white/8 bg-[#0C0C14] overflow-hidden text-xs font-mono shadow-2xl"
    >
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#111118] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-zinc-500 text-[10px]">ILOL · Exam Packet Generator · Q1 2026</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${item.checked ? 'bg-brand-500 text-white' : 'border border-white/20'}`}>
              {item.checked && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span className="text-zinc-200 flex-1">{item.label}</span>
            <span className="text-zinc-600 hidden md:block">{item.detail}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A11] border-t border-white/5">
        <span className="text-zinc-600">Format: <span className="text-zinc-300">PDF</span> · Template: <span className="text-zinc-300">OCC Examination</span></span>
        <button className="px-4 py-1.5 rounded-lg bg-brand-500 text-white text-[11px] font-semibold hover:bg-brand-600 transition-colors">
          Generate Packet →
        </button>
      </div>
    </motion.div>
  );
}

// ── FairnessGauge ─────────────────────────────────────────────────────────
export function FairnessGauge({ air = 0.87 }: { air?: number }) {
  const pct = (air / 1.0) * 100;
  const safe = air >= 0.80;
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
      <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3">Adverse Impact Ratio</div>
      <div className="flex items-end gap-3 mb-3">
        <span className={`text-4xl font-heading font-bold ${safe ? 'text-emerald-400' : 'text-rose-400'}`}>{air}</span>
        <span className={`text-sm mb-1 ${safe ? 'text-emerald-500' : 'text-rose-500'}`}>
          {safe ? '✓ Within threshold' : '⚠ Below threshold'}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${safe ? 'bg-emerald-400' : 'bg-rose-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-zinc-600">
        <span>0.0</span>
        <span className="text-amber-600">↑ 0.80 regulatory floor</span>
        <span>1.0</span>
      </div>
    </motion.div>
  );
}

// ── ModelPerformanceCard ──────────────────────────────────────────────────
export function ModelPerformanceCard() {
  const metrics = [
    { label: 'AUC-ROC',   value: '0.742', status: 'OK',   color: 'text-emerald-400' },
    { label: 'KS Stat',   value: '38.4',  status: 'OK',   color: 'text-emerald-400' },
    { label: 'PSI',       value: '0.07',  status: 'OK',   color: 'text-emerald-400' },
    { label: 'Gini',      value: '0.484', status: 'WARN', color: 'text-amber-400' },
  ];
  return (
    <motion.div variants={fadeUp} className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-zinc-600 uppercase tracking-widest">Model · v3.2.1 (Champion)</div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white/[0.02] rounded-lg px-3 py-2">
            <div className={`text-xl font-heading font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-zinc-500">{m.label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
