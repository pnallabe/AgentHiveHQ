
'use server';
/**
 * @fileOverview A Genkit flow for RuleSense AI to analyze compliance scenarios.
 *
 * - getRuleSenseAnalysis - A function that handles the RuleSense analysis process.
 * - RuleSenseInput - The input type for the getRuleSenseAnalysis function.
 * - RuleSenseOutput - The return type for the getRuleSenseAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RuleSenseInputSchema = z.object({
  scenarioDescription: z.string().describe("A detailed description of the user's regulatory or compliance scenario."),
});
export type RuleSenseInput = z.infer<typeof RuleSenseInputSchema>;

const RuleSenseOutputSchema = z.object({
  scenarioSummary: z.string().describe("A brief summary of the AI's understanding of the user's scenario."),
  complianceChecklist: z.array(z.string()).describe('A step-by-step compliance checklist tailored to the scenario.'),
  relevantCitations: z.array(z.string()).describe('A list of relevant legal or regulatory citations, including specific sections if possible.'),
  actionableGuidance: z.string().describe('Clear, actionable guidance on how to proceed, including next steps or considerations.'),
  potentialRisks: z.array(z.string()).optional().describe('Potential risks or areas of concern that the user should be aware of.'),
});
export type RuleSenseOutput = z.infer<typeof RuleSenseOutputSchema>;

export async function getRuleSenseAnalysis(input: RuleSenseInput): Promise<RuleSenseOutput> {
  return ruleSenseAnalysisFlow(input);
}

const ruleSensePrompt = ai.definePrompt({
  name: 'ruleSenseCompliancePrompt',
  input: { schema: RuleSenseInputSchema },
  output: { schema: RuleSenseOutputSchema },
  prompt: `You are RuleSense, an expert AI assistant specializing in regulatory and compliance matters.
Your goal is to provide comprehensive, clear, and actionable advice based on the user's scenario.

Scenario Description from User:
{{{scenarioDescription}}}

Based on this scenario, please provide the following:
1.  **Scenario Summary**: Briefly summarize your understanding of the user's situation to confirm you've grasped the key points.
2.  **Compliance Checklist**: Generate a detailed, step-by-step checklist of compliance actions the user should consider or undertake. Make these items actionable.
3.  **Relevant Citations**: List key legal acts, regulations, or standards that apply to this scenario. If possible, mention specific sections or articles.
4.  **Actionable Guidance**: Offer clear advice on how the user should proceed. This could include immediate next steps, long-term strategies, or questions they should ask legal counsel.
5.  **Potential Risks (Optional but Recommended)**: If applicable, highlight any potential risks, common pitfalls, or areas of significant concern related to the scenario.

Present your response in the structured JSON format defined by the output schema. Ensure each checklist item, citation, and risk is a separate string in its respective array.
`,
});

const ruleSenseAnalysisFlow = ai.defineFlow(
  {
    name: 'ruleSenseAnalysisFlow',
    inputSchema: RuleSenseInputSchema,
    outputSchema: RuleSenseOutputSchema,
  },
  async (input) => {
    const { output } = await ruleSensePrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a response for the RuleSense analysis.');
    }
    return output;
  }
);
