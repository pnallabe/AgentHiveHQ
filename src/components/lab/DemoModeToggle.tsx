"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Database, Zap } from "lucide-react";
import { useDemoMode } from "@/contexts/demo-mode-context";
import { cn } from "@/lib/utils";

interface DemoModeToggleProps {
  className?: string;
}

export function DemoModeToggle({ className }: DemoModeToggleProps) {
  const { demoMode, toggleDemoMode } = useDemoMode();

  return (
    <div className={cn("w-full", className)}>
      {/* Toggle pill */}
      <button
        onClick={toggleDemoMode}
        aria-pressed={demoMode}
        aria-label={demoMode ? "Disable demo mode" : "Enable demo mode"}
        className={cn(
          "relative inline-flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          demoMode
            ? "border-amber-700/60 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60"
            : "border-surface-border bg-surface-overlay text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        )}
      >
        <span className="flex items-center gap-2">
          {demoMode ? (
            <Zap className="h-3 w-3 fill-amber-400 text-amber-400" />
          ) : (
            <Database className="h-3 w-3 text-zinc-500" />
          )}
          <span>{demoMode ? "Demo Mode" : "Live Mode"}</span>
        </span>
        {/* Track + thumb */}
        <span
          className={cn(
            "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-200",
            demoMode ? "border-amber-700 bg-amber-500/30" : "border-zinc-700 bg-zinc-800"
          )}
        >
          <span
            className={cn(
              "absolute h-2.5 w-2.5 rounded-full transition-all duration-200",
              demoMode ? "left-[14px] bg-amber-400" : "left-[2px] bg-zinc-500"
            )}
          />
        </span>
      </button>

      {/* Animated amber banner */}
      <AnimatePresence initial={false}>
        {demoMode && (
          <motion.div
            key="demo-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 36, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 rounded-b-md bg-amber-950/30 px-3 py-2">
              <Zap className="h-3 w-3 text-amber-500" aria-hidden />
              <p className="font-mono text-[10px] text-amber-600">
                Synthetic data — no real PII
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
