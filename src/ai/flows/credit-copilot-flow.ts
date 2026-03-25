'use server';
/**
 * @fileOverview Genkit Gemini 2.0 Flash flow for AI Copilot credit decision narratives.
 *
 * Story 4.5: Replaces the FastAPI copilot HTTP call. LLM narrative generation
 * stays in the Next.js layer and uses the existing Gemini configuration.
 *
 * - getCreditCopilotNarrative  — server action, called from CopilotNarrative component
 * - CreditCopilotInput         — input type
 * - CreditCopilotOutput        — output type (matches CopilotResponse in types.ts)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ── Pre-computed APR helper (avoids Handlebars math helper) ──────────────────

function computeAprMonthly(apr: number | null | undefined): string {
  if (apr == null) return "N/A";
  return ((apr / 12) * 10).toFixed(2);
}

// ── Input schema ──────────────────────────────────────────────────────────────

const DecisionAuditSchema = z.object({
  timestamp:           z.string(),
  model_version:       z.string(),
  model_artifact_hash: z.string().optional(),
  rules_evaluated:     z.number().optional(),
  rules_triggered:     z.array(z.string()),
  rules_overridden:    z.boolean().optional(),
  demo_mode:           z.boolean().optional(),
});

const ReasonCodeSchema = z.union([
  z.string(),
  z.object({
    code:        z.string(),
    fcra_code:   z.string().optional(),
    description: z.string().optional(),
  }),
]);

const UnderwritingResponseSchema = z.object({
  decision_id:      z.string(),
  decision:         z.enum(['approve', 'reject', 'review']),
  credit_limit:     z.number().nullable().optional(),
  apr:              z.number().nullable().optional(),
  confidence_score: z.number(),
  risk_segment:     z.string(),
  reason_codes:     z.array(ReasonCodeSchema),
  fcra_codes:       z.array(z.string()).optional(),
  explanations:     z.record(z.string(), z.number()),
  audit:            DecisionAuditSchema,
});

const CreditCopilotInputSchema = z.object({
  decision_response:  UnderwritingResponseSchema,
  applicant_context:  z.string().optional().default(''),
  /** Pre-computed monthly interest cost per $1,000 balance — avoids LLM arithmetic */
  apr_monthly_cost:   z.string().optional().default(''),
});

export type CreditCopilotInput = z.infer<typeof CreditCopilotInputSchema>;

// ── Output schema ─────────────────────────────────────────────────────────────

const CreditCopilotOutputSchema = z.object({
  narrative: z
    .string()
    .describe('Exactly 3 sentences. No hallucinated numbers. FCRA-compliant language.'),
  risk_flags: z
    .array(z.string())
    .max(3)
    .describe('Up to 3 specific risk factors drawn from the decision data.'),
  recommendations: z
    .array(z.string())
    .max(3)
    .describe('Up to 3 concrete, actionable improvement steps for the applicant.'),
  plain_english_apr: z
    .string()
    .describe(
      'Monthly cost per $1,000 balance using formula: apr/12 * (1000/100) = $/month.'
    ),
});

export type CreditCopilotOutput = z.infer<typeof CreditCopilotOutputSchema>;

// ── Fallback template (used when Gemini call fails) ──────────────────────────

function buildFallbackNarrative(input: CreditCopilotInput): CreditCopilotOutput {
  const dr = input.decision_response;
  const { decision, credit_limit, apr, risk_segment, confidence_score, reason_codes } = dr;

  const reasonText = reason_codes
    .map((rc) => (typeof rc === 'string' ? rc : rc.description ?? rc.code))
    .filter(Boolean)
    .join('; ') || 'no specific adverse factors';

  let narrative: string;
  let risk_flags: string[];
  let recommendations: string[];

  if (decision === 'approve') {
    const limitStr = credit_limit ? `$${credit_limit.toLocaleString()}` : 'a credit limit';
    const aprStr = apr ? `${apr.toFixed(2)}%` : 'a competitive rate';
    narrative =
      `Your application has been approved with ${limitStr} at ${aprStr} APR based on your financial profile and ${risk_segment.replace('-', ' ')} credit standing. ` +
      `Your application demonstrated a confidence score of ${(confidence_score * 100).toFixed(0)}%, reflecting a solid overall financial picture. ` +
      `Your account will be activated upon acceptance of the terms — please review all conditions carefully before proceeding.`;
    risk_flags = [
      'Keep credit utilisation below 30% of your approved limit to protect your credit score.',
      `Your ${risk_segment.replace('-', ' ')} segment may qualify for a rate reduction after 12 months of on-time payments.`,
    ];
    recommendations = [
      'Set up automatic payments to avoid missed due dates.',
      'Keep your balance below 30% of your credit limit.',
      'Review your credit report annually at AnnualCreditReport.com.',
    ];
  } else if (decision === 'review') {
    narrative =
      `Your application requires additional review before a final decision can be made — this is not a rejection. ` +
      `The review was triggered by ${reasonText}. ` +
      `A credit specialist will contact you within 2 business days with next steps and any documentation required.`;
    risk_flags = reason_codes
      .slice(0, 3)
      .map((rc) => (typeof rc === 'string' ? rc : rc.description ?? rc.code ?? ''))
      .filter(Boolean);
    recommendations = [
      'Prepare documentation of any additional income sources.',
      'Consider providing a co-signer with an established credit history.',
      'Contact our credit team directly to discuss your application.',
    ];
  } else {
    // reject
    narrative =
      `After careful review, we are unable to approve your application at this time due to ${reasonText}. ` +
      `This decision was based solely on financial factors as reported — not on personal characteristics. ` +
      `You have the right to request a free copy of your credit report and dispute any inaccuracies within 60 days.`;
    risk_flags = reason_codes
      .slice(0, 3)
      .map((rc) => (typeof rc === 'string' ? rc : rc.description ?? rc.code ?? ''))
      .filter(Boolean);
    if (!risk_flags.length) risk_flags = ['Credit profile does not meet current underwriting requirements.'];
    recommendations = [
      'Request your free credit report at AnnualCreditReport.com and dispute any errors.',
      'Focus on increasing income stability over the next 6–12 months.',
      'Consider a secured credit card to build or rebuild credit history.',
    ];
  }

  const aprMonthly = apr ? (apr / 12) * (1000 / 100) : 0;
  const plain_english_apr = apr
    ? `For every $1,000 balance, you'd pay approximately $${aprMonthly.toFixed(2)}/month in interest.`
    : 'No interest charges apply — a credit line was not approved at this time.';

  return {
    narrative: narrative.trim(),
    risk_flags: risk_flags.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    plain_english_apr,
  };
}

// ── Genkit prompt ─────────────────────────────────────────────────────────────

const creditCopilotPrompt = ai.definePrompt({
  name: 'creditCopilotNarrativePrompt',
  input:  { schema: CreditCopilotInputSchema },
  output: { schema: CreditCopilotOutputSchema },
  prompt: `You are a credit analyst at a regulated consumer lending institution.
You explain credit decisions in a clear, empathetic, and FCRA-compliant manner.

STRICT RULES:
- narrative MUST be exactly 3 sentences. No more, no less.
- Never invent numbers not present in the decision data.
- On rejection, always include an actionable improvement path.
- Use plain English. Avoid jargon.
- All values (amounts, %) must come directly from the input — NO hallucination.

Decision Data:
- Decision: {{decision_response.decision}}
- Risk Segment: {{decision_response.risk_segment}}
- Credit Limit: {{decision_response.credit_limit}}
- APR: {{decision_response.apr}}%
- Confidence Score: {{decision_response.confidence_score}}
{{#if applicant_context}}- Applicant Context: {{applicant_context}}{{/if}}

Reason Codes:
{{#each decision_response.reason_codes}}
{{this}}
{{/each}}

plain_english_apr:
  Pre-computed monthly cost per $1,000: {{apr_monthly_cost}} per month.
  Write it as: "For every $1,000 balance, you'd pay approximately ${'$'}{{apr_monthly_cost}}/month in interest."
  (Use exactly this value — do not calculate your own.)

Generate the narrative, risk_flags (max 3), recommendations (max 3), and plain_english_apr.`,
});

// ── Genkit flow ───────────────────────────────────────────────────────────────

const creditCopilotFlow = ai.defineFlow(
  {
    name: 'creditCopilotFlow',
    inputSchema:  CreditCopilotInputSchema,
    outputSchema: CreditCopilotOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await creditCopilotPrompt(input);
      if (!output) throw new Error('Empty output from Gemini');

      const apr = input.decision_response.apr;
      const precomputedMonthly = input.apr_monthly_cost;

      // Override APR sentence to guarantee correctness
      const validApr = apr && precomputedMonthly
        ? `For every $1,000 balance, you'd pay approximately $${precomputedMonthly}/month in interest.`
        : output.plain_english_apr || 'No interest charges apply — a credit line was not approved at this time.';

      return {
        narrative:         (output.narrative ?? '').trim(),
        risk_flags:        (output.risk_flags ?? []).slice(0, 3),
        recommendations:   (output.recommendations ?? []).slice(0, 3),
        plain_english_apr: validApr,
      };
    } catch {
      // Gemini failed — return deterministic fallback.
      return buildFallbackNarrative(input);
    }
  }
);

// ── Public server action ──────────────────────────────────────────────────────

/**
 * Server action — called from client components via the server action boundary.
 * Returns a CopilotResponse-shaped object.
 */
export async function getCreditCopilotNarrative(
  input: CreditCopilotInput
): Promise<CreditCopilotOutput> {
  // Pre-compute APR monthly cost to avoid LLM arithmetic errors
  const apr_monthly_cost = computeAprMonthly(input.decision_response.apr);
  const enriched: CreditCopilotInput = { ...input, apr_monthly_cost };

  try {
    return await creditCopilotFlow(enriched);
  } catch {
    // Final safety net — always return something useful.
    return buildFallbackNarrative(enriched);
  }
}
