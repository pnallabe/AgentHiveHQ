"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fadeInUp, defaultViewport } from "@/lib/animations";

// ── The JSON payload displayed in the terminal preview ───────────────────────

const TERMINAL_JSON = `{
  "decision_id": "018e8f2a-7c3d-7000-8000-abc123",
  "decision": "approve",
  "credit_limit": 7500.00,
  "apr": 19.99,
  "confidence_score": 0.78,
  "risk_segment": "near_prime",
  "reason_codes": [
    "STABLE_EMPLOYMENT",
    "INCOME_MEETS_THRESHOLD"
  ],
  "explanations": {
    "income_log": 0.42,
    "employment_length": 0.18,
    "thin_file_flag": -0.31,
    "housing_encoded": -0.05,
    "credit_score_imputed": 0.24
  },
  "audit": {
    "timestamp": "2026-03-24T10:00:00.000Z",
    "model_version": "sha256:a3f2b1c9",
    "rules_evaluated": 4,
    "rules_triggered": [],
    "processing_time_ms": 287,
    "demo_mode": false
  }
}`;

// ── Syntax highlight token colors ────────────────────────────────────────────

type TokenType = "key" | "string" | "number" | "boolean" | "punctuation" | "null";

interface Token {
  type: TokenType;
  text: string;
}

function tokenize(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < json.length) {
    // Whitespace / newline / comma
    if (/[\s,]/.test(json[i])) {
      tokens.push({ type: "punctuation", text: json[i] });
      i++;
      continue;
    }
    // Braces / brackets / colon
    if (/[{}[\]:]/.test(json[i])) {
      tokens.push({ type: "punctuation", text: json[i] });
      i++;
      continue;
    }
    // String
    if (json[i] === '"') {
      let str = '"';
      i++;
      while (i < json.length && json[i] !== '"') {
        str += json[i++];
      }
      str += '"';
      i++; // closing quote
      // Peek forward: if value after colon it's a key candidate
      const nextNonWs = json.slice(i).trimStart();
      if (nextNonWs.startsWith(":")) {
        tokens.push({ type: "key", text: str });
      } else {
        tokens.push({ type: "string", text: str });
      }
      continue;
    }
    // Number
    const numMatch = json.slice(i).match(/^-?\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ type: "number", text: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }
    // Boolean / null
    if (json.slice(i).startsWith("true")) {
      tokens.push({ type: "boolean", text: "true" });
      i += 4;
      continue;
    }
    if (json.slice(i).startsWith("false")) {
      tokens.push({ type: "boolean", text: "false" });
      i += 5;
      continue;
    }
    if (json.slice(i).startsWith("null")) {
      tokens.push({ type: "null", text: "null" });
      i += 4;
      continue;
    }
    tokens.push({ type: "punctuation", text: json[i] });
    i++;
  }

  return tokens;
}

const TOKEN_COLORS: Record<TokenType, string> = {
  key:        "text-blue-400",
  string:     "text-amber-300",
  number:     "text-emerald-400",
  boolean:    "text-violet-400",
  null:       "text-violet-400",
  punctuation:"text-zinc-500",
};

const TOKENS = tokenize(TERMINAL_JSON);
const FULL_TEXT = TERMINAL_JSON;

// ── Component ────────────────────────────────────────────────────────────────

export function TerminalPreviewSection() {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [visibleLen, setVisibleLen] = useState(prefersReduced ? FULL_TEXT.length : 0);

  useEffect(() => {
    if (!isInView) return;
    if (prefersReduced) {
      setVisibleLen(FULL_TEXT.length);
      return;
    }
    let cursor = 0;
    const SPEED = 12; // ms per char
    const id = setInterval(() => {
      cursor = Math.min(cursor + 2, FULL_TEXT.length);
      setVisibleLen(cursor);
      if (cursor >= FULL_TEXT.length) clearInterval(id);
    }, SPEED);
    return () => clearInterval(id);
  }, [isInView, prefersReduced]);

  // Build visible char budget across tokens
  let remaining = visibleLen;
  const visibleTokens = TOKENS.map((tok) => {
    if (remaining <= 0) return { ...tok, text: "" };
    const show = tok.text.slice(0, remaining);
    remaining -= tok.text.length;
    return { ...tok, text: show };
  });

  return (
    <section className="bg-surface-base py-20 md:py-24" aria-labelledby="terminal-heading">
      <div className="mx-auto max-w-4xl px-4 sm:px-6" ref={ref}>
        <motion.div
          className="text-center"
          variants={fadeInUp}
          initial={prefersReduced ? "visible" : "hidden"}
          whileInView="visible"
          viewport={defaultViewport}
        >
          <h2
            id="terminal-heading"
            className="font-heading text-3xl font-bold tracking-tight text-zinc-50"
          >
            See a Decision.{" "}
            <span className="bg-gradient-to-r from-brand-400 to-brand-300 bg-clip-text text-transparent">
              In Real Time.
            </span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            Every decision returns a structured, auditable JSON payload.
          </p>
        </motion.div>

        {/* Terminal card */}
        <div
          className="mt-10 overflow-hidden rounded-2xl border border-surface-border bg-zinc-950"
          role="img"
          aria-label="Example decision API response"
        >
          {/* Top bar */}
          <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff605c]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#ffbd44]" aria-hidden />
            <span className="h-3 w-3 rounded-full bg-[#00ca4e]" aria-hidden />
            <span className="ml-3 font-mono text-xs text-zinc-500">
              POST /api/underwriting/decision
            </span>
          </div>

          {/* JSON content — pre-allocated height to prevent layout shift */}
          <div className="overflow-auto p-5">
            <pre
              className="font-mono text-xs leading-6"
              style={{ minHeight: "380px" }}
              aria-live="polite"
            >
              {visibleTokens.map((tok, i) => (
                <span key={i} className={TOKEN_COLORS[tok.type]}>
                  {tok.text}
                </span>
              ))}
              {visibleLen < FULL_TEXT.length && (
                <span className="cursor-blink text-brand-400">▊</span>
              )}
            </pre>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Button
            asChild
            variant="outline"
            className="border-surface-border text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
          >
            <Link href="/lab/underwriting">
              Run Your Own
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
