'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Home } from 'lucide-react';
import Link from 'next/link';

interface DeckLayoutProps {
  slides: React.ReactNode[];
  title: string;
  accentColor?: 'blue' | 'emerald';
  backHref?: string;
}

export function DeckLayout({
  slides,
  title,
  accentColor = 'blue',
  backHref = '/',
}: DeckLayoutProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = slides.length;

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= total) return;
      setDirection(next > current ? 1 : -1);
      setCurrent(next);
    },
    [current, total]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') go(current + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(current - 1);
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(total - 1);
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go, current, total, fullscreen]);

  const handlePrint = () => {
    // Render ALL slides into the DOM, then trigger the browser print dialog.
    // The @media print CSS gives each slide its own page.
    setPrinting(true);
    setTimeout(() => {
      window.print();
      // `afterprint` fires when the dialog is dismissed (saved or cancelled)
      const cleanup = () => {
        setPrinting(false);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      // Fallback in case afterprint doesn't fire (e.g. some mobile browsers)
      setTimeout(() => {
        setPrinting(false);
        window.removeEventListener('afterprint', cleanup);
      }, 30_000);
    }, 500); // 500 ms gives React time to paint all slides
  };

  const toggleFullscreen = () => {
    if (!fullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  };

  const accent =
    accentColor === 'emerald'
      ? { ring: 'ring-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500', dot: '#10b981' }
      : { ring: 'ring-brand-500', text: 'text-brand-400', bg: 'bg-brand-500', dot: '#3366f4' };

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({
      x: d > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  // ── Print mode: render all slides stacked, one page each ─────────
  if (printing) {
    return (
      <div
        className="bg-[#05050A]"
        style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="deck-print-slide"
            style={{
              width: '100vw',
              height: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#05050A',
              pageBreakAfter: 'always',
              breakAfter: 'page',
              overflow: 'hidden',
            }}
          >
            {slide}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-screen bg-[#05050A] overflow-hidden select-none"
      style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, sans-serif' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#05050A]/80 backdrop-blur-sm print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
          >
            <Home size={14} />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className="text-zinc-700">·</span>
          <span className={`text-sm font-semibold ${accent.text}`}>{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm tabular-nums">
            {current + 1} / {total}
          </span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs transition-all border border-white/5"
            title="Export to PDF"
          >
            <Download size={13} />
            <span>Export PDF</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
            title="Toggle fullscreen"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ── Slide area ───────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.38 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {slides[current]}
          </motion.div>
        </AnimatePresence>

        {/* Side nav arrows */}
        <button
          onClick={() => go(current - 1)}
          disabled={current === 0}
          className="print:hidden absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          onClick={() => go(current + 1)}
          disabled={current === total - 1}
          className="print:hidden absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* ── Slide dots ───────────────────────────────────────────────── */}
      <div className="print:hidden relative z-20 flex items-center justify-center gap-1.5 py-3 border-t border-white/5 bg-[#05050A]/80">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current
                ? `w-6 ${accent.bg}`
                : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
            }`}
          />
        ))}
      </div>

      {/* ── Keyboard hint ────────────────────────────────────────────── */}
      <motion.p
        className="print:hidden absolute bottom-12 left-1/2 -translate-x-1/2 text-zinc-600 text-[10px] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        ← → arrow keys to navigate
      </motion.p>
    </div>
  );
}
