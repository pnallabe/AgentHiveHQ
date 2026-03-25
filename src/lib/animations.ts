/**
 * Framer Motion animation variants — Sprint 6.1
 *
 * All variants respect prefers-reduced-motion via the shouldReduceMotion()
 * helper. Import this file into any component that uses Framer Motion.
 */
import type { Variants } from "framer-motion";

// ── Reduced-motion guard ─────────────────────────────────────────────────────

/**
 * Returns true if the user has requested reduced motion (WCAG 2.3.3).
 * Call this inside useEffect / event handlers — not during SSR.
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ── Base variants ─────────────────────────────────────────────────────────────

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

// ── Container variant — staggers children ────────────────────────────────────

export const staggerChildren: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0,
    },
  },
};

export const staggerChildrenFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

// ── Slide variants ───────────────────────────────────────────────────────────

export const slideInFromLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

export const slideInFromRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// ── Height expand (demo mode banner, etc.) ───────────────────────────────────

export const expandHeight = {
  initial: { height: 0, opacity: 0, overflow: "hidden" },
  animate: { height: "auto", opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit:    { height: 0, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
};

// ── Default viewport props for whileInView ───────────────────────────────────

export const defaultViewport = { once: true, margin: "-80px" } as const;
