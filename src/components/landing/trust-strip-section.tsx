"use client";

import { motion, useReducedMotion } from "framer-motion";
import { staggerChildren, fadeInUp, defaultViewport } from "@/lib/animations";

// ── Stats that demonstrate production credibility ────────────────────────────
// These are DESIGN TARGETS / demo-environment figures, not measured production
// SLAs. The section header labels them as such to stay honest with technical
// buyers who inspect the numbers.

const STATS = [
	{
		value: "$2.4B+",
		label: "Credit volume evaluated",
		sub: "demo dataset, cumulative",
	},
	{
		value: "340ms",
		label: "Median decision latency",
		sub: "demo environment, P99 < 500ms",
	},
	{
		value: "99.9%",
		label: "Uptime target",
		sub: "SLA on paid plans",
	},
	{
		value: "0",
		label: "Active bias flags",
		sub: "continuous adverse-impact monitoring",
	},
];

// ── Component ────────────────────────────────────────────────────────────────

export function TrustStripSection() {
	const prefersReduced = useReducedMotion();

	return (
		<section
			aria-label="Platform performance statistics"
			className="border-b border-surface-border bg-surface-raised py-12"
		>
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
					Design targets — demo environment
				</p>
				<motion.div
					className="grid grid-cols-2 gap-6 md:grid-cols-4"
					variants={staggerChildren}
					initial={prefersReduced ? "visible" : "hidden"}
					whileInView="visible"
					viewport={defaultViewport}
				>
					{STATS.map((stat) => (
						<motion.div
							key={stat.label}
							variants={fadeInUp}
							className="flex flex-col gap-1 border-l border-surface-border pl-4 first:border-l-0 first:pl-0 md:first:border-l md:first:pl-4"
						>
							<p className="font-heading text-2xl font-bold tabular-nums text-zinc-50 sm:text-3xl">
								{stat.value}
							</p>
							<p className="text-sm font-medium text-zinc-300">
								{stat.label}
							</p>
							<p className="font-mono text-[10px] text-zinc-600">
								{stat.sub}
							</p>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
