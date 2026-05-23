'use server';
/**
 * @fileOverview Genkit Gemini 2.0 Flash flow for the AI Executive Brief.
 *
 * Ingests a lightweight KPI snapshot from the analytics API and generates
 * a concise board-ready narrative with:
 *   - headline: one-sentence overall performance summary
 *   - summary: two-to-three sentence narrative
 *   - highlights: 2–3 positive bullet points
 *   - risks: 2–3 watch-item bullet points
 *
 * IMPORTANT: No PII is passed to the LLM. Only aggregate KPI values.
 *
 * Tone tokens:
 *   board_brief    — terse, jargon-free, C-suite
 *   management_update — detail level for ExCo / CFO review
 *   technical      — metrics-dense for risk/finance teams
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

const ToneSchema = z.enum(['board_brief', 'management_update', 'technical']);

const KpiSnapshotSchema = z.object({
  /** Net Interest Income for the selected period (GBP) */
  net_interest_income: z.number().nullable().optional(),
  /** NPL rate as a decimal (0.018 = 1.8%) */
  npl_rate: z.number().nullable().optional(),
  /** Total originations volume (GBP) */
  originations_volume: z.number().nullable().optional(),
  /** Net Interest Margin as a decimal */
  net_interest_margin: z.number().nullable().optional(),
  /** Plan attainment ratio for revenue (1.0 = on plan) */
  revenue_attainment: z.number().nullable().optional(),
  /** Board-approved NPL ceiling */
  npl_plan_ceiling: z.number().nullable().optional(),
  /** Year-end NII p50 projection (GBP) — may be null before projections loaded */
  year_end_nii_p50: z.number().nullable().optional(),
  /** Any active top-risk descriptions (max 3) */
  top_risk_descriptions: z.array(z.string()).optional(),
  /** Human-readable period label, e.g. "YTD" */
  period_label: z.string().optional().default('YTD'),
  /** "Credit Cards" | "Mortgages" | "All Products" */
  product_label: z.string().optional().default('All Products'),
  /** Data availability: "full" | "partial" | "demo" */
  data_availability: z.string().optional().default('full'),
});

export const ExecutiveBriefInputSchema = z.object({
  kpi_snapshot: KpiSnapshotSchema,
  tone: ToneSchema.optional().default('board_brief'),
  /** ISO timestamp of data freshness for traceability */
  data_as_of: z.string().optional(),
});

export type ExecutiveBriefInput = z.infer<typeof ExecutiveBriefInputSchema>;

const ExecutiveBriefOutputSchema = z.object({
  headline: z
    .string()
    .describe('One crisp sentence (max 20 words) capturing portfolio performance.'),
  summary: z
    .string()
    .describe('Two to three sentences of context-rich narrative. No PII.'),
  highlights: z
    .array(z.string())
    .describe('2-3 positive performance highlights as brief bullet strings.'),
  risks: z
    .array(z.string())
    .describe('2-3 risk watch items as brief bullet strings. Be specific.'),
  generated_at: z
    .string()
    .describe('ISO timestamp of brief generation — populated server-side.'),
});

export type ExecutiveBriefOutput = z.infer<typeof ExecutiveBriefOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtGbp(v: number | null | undefined): string {
  if (v == null) return 'N/A';
  const a = Math.abs(v);
  if (a >= 1e9) return `£${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `£${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `£${(v / 1e3).toFixed(0)}k`;
  return `£${v.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return 'N/A';
  return `${(v * 100).toFixed(2)}%`;
}

function buildPrompt(input: ExecutiveBriefInput): string {
  const { kpi_snapshot: kpi, tone, data_as_of } = input;

  const toneInstruction: Record<string, string> = {
    board_brief:
      'Use concise board-brief style: short sentences, no jargon, focus on materiality and action-ability. Assume the reader is a non-financial board member.',
    management_update:
      'Use management-update style: more detail, include trend context, appropriate for CFO / ExCo audience.',
    technical:
      'Use technical style: quote metrics precisely with units (bps, %, £M), mention drivers and model assumptions where relevant.',
  };

  const isDemo = kpi.data_availability !== 'full';
  const demoWarning = isDemo
    ? '\n\n⚠️ NOTE: This brief is based on SAMPLE DATA for demonstration purposes only. Clearly state this in the summary.'
    : '';

  const risks = (kpi.top_risk_descriptions ?? []).slice(0, 3).join('; ') || 'No critical risks flagged';

  return `You are an executive analytics AI for a UK retail bank (AgentHive platform).
Generate a concise executive brief for the ${kpi.period_label} period covering: ${kpi.product_label}.

TONE: ${toneInstruction[tone ?? 'board_brief']}
DATA AS OF: ${data_as_of ?? 'not provided'}${demoWarning}

KEY METRICS (aggregate only — no customer PII):
- Net Interest Income: ${fmtGbp(kpi.net_interest_income)}
- Net Interest Margin: ${fmtPct(kpi.net_interest_margin)}
- Total Originations: ${fmtGbp(kpi.originations_volume)}
- NPL Rate: ${fmtPct(kpi.npl_rate)}${kpi.npl_plan_ceiling != null ? ` (plan ceiling: ${fmtPct(kpi.npl_plan_ceiling)})` : ''}
- Revenue vs Plan: ${kpi.revenue_attainment != null ? `${(kpi.revenue_attainment * 100 - 100).toFixed(1)}% vs plan` : 'N/A'}
- Year-end NII Forecast (p50): ${fmtGbp(kpi.year_end_nii_p50)}
- Active Risk Flags: ${risks}

REQUIREMENTS:
1. "headline": ONE sentence (max 20 words) — overall portfolio verdict.
2. "summary": TWO to THREE sentences — narrative connecting KPIs to strategic context.
3. "highlights": Array of 2–3 strings — specific positive data points beginning with a metric.
4. "risks": Array of 2–3 strings — specific watch items beginning with a metric or flag.
5. "generated_at": Leave as empty string — will be populated by the server.
6. Do NOT invent data. If a value is N/A, acknowledge uncertainty rather than fabricating.
7. Do NOT include any personal names, account numbers, or customer data.

Respond ONLY with valid JSON matching the output schema.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Genkit flow
// ─────────────────────────────────────────────────────────────────────────────

const executiveBriefFlow = ai.defineFlow(
  {
    name: 'executiveBriefFlow',
    inputSchema: ExecutiveBriefInputSchema,
    outputSchema: ExecutiveBriefOutputSchema,
  },
  async (input) => {
    const prompt = buildPrompt(input);

    const { output } = await ai.generate({
      prompt,
      output: { schema: ExecutiveBriefOutputSchema },
      config: {
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    });

    if (!output) {
      throw new Error('[executive-brief-flow] LLM returned no structured output');
    }

    // Populate generated_at server-side (never trust LLM for timestamps)
    return {
      ...output,
      generated_at: new Date().toISOString(),
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Server action — called from client components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateExecutiveBrief — Next.js server action.
 *
 * Usage:
 *   import { generateExecutiveBrief } from '@/ai/flows/executive-brief-flow';
 *   const brief = await generateExecutiveBrief({ kpi_snapshot, tone });
 */
export async function generateExecutiveBrief(
  input: ExecutiveBriefInput
): Promise<ExecutiveBriefOutput> {
  return executiveBriefFlow(input);
}
