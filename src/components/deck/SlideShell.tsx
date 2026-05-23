'use client';

import React from 'react';
import { motion } from 'framer-motion';

// ── SlideShell ─────────────────────────────────────────────────────────────
// Wraps every slide with consistent padding + staggered child animations.

interface SlideShellProps {
  children: React.ReactNode;
  className?: string;
  /** Optional left-border accent color */
  accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'none';
  /** Full bleed background — bypasses padding */
  fullBleed?: boolean;
}

const ACCENT_CLASSES: Record<string, string> = {
  blue:    'border-l-2 border-brand-500',
  emerald: 'border-l-2 border-emerald-500',
  amber:   'border-l-2 border-amber-400',
  rose:    'border-l-2 border-rose-500',
  none:    '',
};

export const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.09 } },
};
export const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};
export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

export function SlideShell({ children, className = '', accent = 'none', fullBleed = false }: SlideShellProps) {
  const padding = fullBleed ? '' : 'px-8 md:px-16 lg:px-20 py-8 md:py-10';
  return (
    <motion.div
      className={`w-full h-full flex flex-col justify-center ${padding} ${ACCENT_CLASSES[accent]} ${className}`}
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

// ── SlideBadge ─────────────────────────────────────────────────────────────
export function SlideBadge({ children, color = 'blue' }: { children: React.ReactNode; color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const cls = {
    blue:    'bg-brand-500/10 text-brand-300 border-brand-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-300 border-amber-500/20',
    rose:    'bg-rose-500/10 text-rose-300 border-rose-500/20',
    violet:  'bg-violet-500/10 text-violet-300 border-violet-500/20',
  }[color];
  return (
    <motion.span
      variants={fadeUp}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border uppercase ${cls}`}
    >
      {children}
    </motion.span>
  );
}

// ── SlideTitle ─────────────────────────────────────────────────────────────
export function SlideTitle({ children, size = 'lg' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizes = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-3xl md:text-4xl',
    lg: 'text-4xl md:text-5xl',
    xl: 'text-5xl md:text-6xl lg:text-7xl',
  };
  return (
    <motion.h1
      variants={fadeUp}
      className={`font-heading font-bold leading-[1.08] tracking-tight text-white ${sizes[size]}`}
    >
      {children}
    </motion.h1>
  );
}

// ── SlideSubtitle ──────────────────────────────────────────────────────────
export function SlideSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      variants={fadeUp}
      className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl"
    >
      {children}
    </motion.p>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
interface StatCardProps {
  value: string;
  label: string;
  trend?: string;
  color?: 'blue' | 'emerald' | 'amber' | 'rose';
}
export function StatCard({ value, label, trend, color = 'blue' }: StatCardProps) {
  const border = {
    blue:    'border-brand-500/20 hover:border-brand-500/40',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    amber:   'border-amber-500/20 hover:border-amber-500/40',
    rose:    'border-rose-500/20 hover:border-rose-500/40',
  }[color];
  const textColor = {
    blue:    'text-brand-400',
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    rose:    'text-rose-400',
  }[color];
  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-xl border bg-white/[0.025] px-5 py-4 transition-colors ${border}`}
    >
      <div className={`text-3xl md:text-4xl font-heading font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-1 uppercase tracking-wide">{label}</div>
      {trend && <div className="text-[11px] text-zinc-500 mt-0.5">{trend}</div>}
    </motion.div>
  );
}

// ── GlassCard ─────────────────────────────────────────────────────────────
export function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-xl border border-white/8 bg-white/[0.028] backdrop-blur-sm p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ── BulletRow ─────────────────────────────────────────────────────────────
export function BulletRow({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <motion.div variants={fadeUp} className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-brand-400">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{label}</div>
        {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────
export function Divider() {
  return <motion.div variants={fadeIn} className="w-12 h-0.5 bg-brand-500/50 my-4" />;
}

// ── GradientText ──────────────────────────────────────────────────────────
export function GradientText({ children, gradient = 'blue-cyan' }: { children: React.ReactNode; gradient?: 'blue-cyan' | 'blue-purple' | 'green-cyan' }) {
  const g = {
    'blue-cyan':   'from-brand-400 to-cyan-300',
    'blue-purple': 'from-brand-400 to-violet-400',
    'green-cyan':  'from-emerald-400 to-cyan-300',
  }[gradient];
  return (
    <span className={`bg-gradient-to-r ${g} bg-clip-text text-transparent`}>
      {children}
    </span>
  );
}

// ── Tag ───────────────────────────────────────────────────────────────────
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/6 border border-white/8 text-[11px] text-zinc-400 font-mono">
      {children}
    </span>
  );
}
