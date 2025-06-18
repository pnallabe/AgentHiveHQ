
'use server';
/**
 * @fileOverview A Genkit flow for RuleSense AI to analyze compliance scenarios,
 * optionally considering an uploaded document's content and providing a summary.
 *
 * - getRuleSenseAnalysis - A function that handles the RuleSense analysis process.
 * - RuleSenseInput - The input type for the getRuleSenseAnalysis function.
 * - RuleSenseOutput - The return type for the getRuleSenseAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RuleSenseInputSchema = z.object({
  scenarioDescription: z.string().describe("A detailed description of the user's regulatory or compliance scenario."),
  documentContext: z.string().optional().describe('Optional textual content or description of an uploaded document to be considered and summarized.'),
});
export type RuleSenseInput = z.infer<typeof RuleSenseInputSchema>;

const RuleSenseOutputSchema = z.object({
  scenarioSummary: z.string().describe("A brief summary of the AI's understanding of the user's scenario."),
  complianceChecklist: z.array(z.string()).describe('A step-by-step compliance checklist tailored to the scenario.'),
  relevantCitations: z.array(z.string()).describe('A list of relevant legal or regulatory citations, including specific sections if possible.'),
  actionableGuidance: z.string().describe('Clear, actionable guidance on how to proceed, including next steps or considerations.'),
  potentialRisks: z.array(z.string()).optional().describe('Potential risks or areas of concern that the user should be aware of.'),
  documentSummary: z.string().optional().describe('A concise summary of the provided document context, if any.'),
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
Your goal is to provide comprehensive, clear, and actionable advice based on the user's scenario and any provided document context.

Scenario Description from User:
{{{scenarioDescription}}}

{{#if documentContext}}
Additional Context from Uploaded Document:
{{{documentContext}}}

Based on the scenario AND the document context (if provided), please provide the following:
1.  **Scenario Summary**: Briefly summarize your understanding of the user's situation, incorporating key points from the document if relevant.
2.  **Compliance Checklist**: Generate a detailed, step-by-step checklist of compliance actions.
3.  **Relevant Citations**: List key legal acts, regulations, or standards that apply.
4.  **Actionable Guidance**: Offer clear advice on how the user should proceed.
5.  **Potential Risks (Optional but Recommended)**: Highlight any potential risks or areas of concern.
6.  **Document Summary**: If documentContext was provided, generate a concise summary of its content. If no documentContext was provided, omit this field or leave it empty.
{{else}}
Based on the scenario, please provide the following:
1.  **Scenario Summary**: Briefly summarize your understanding of the user's situation.
2.  **Compliance Checklist**: Generate a detailed, step-by-step checklist of compliance actions.
3.  **Relevant Citations**: List key legal acts, regulations, or standards that apply.
4.  **Actionable Guidance**: Offer clear advice on how the user should proceed.
5.  **Potential Risks (Optional but Recommended)**: Highlight any potential risks or areas of concern.
{{/if}}

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

