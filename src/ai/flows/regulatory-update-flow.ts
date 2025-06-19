
'use server';
/**
 * @fileOverview A Genkit flow for summarizing regulatory text.
 *
 * - summarizeRegulatoryText - A function that takes text and returns a structured summary.
 * - RegulatoryUpdateInput - The input type for the summarizeRegulatoryText function.
 * - RegulatoryUpdateOutput - The return type for the summarizeRegulatoryText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RegulatoryUpdateInputSchema = z.object({
  amendmentText: z.string().describe('The full text of the regulatory amendment to be summarized.'),
  sourceName: z.string().optional().describe('Optional: The name of the source of the amendment, e.g., "eCFR Title 12".'),
});
export type RegulatoryUpdateInput = z.infer<typeof RegulatoryUpdateInputSchema>;

const RegulatoryUpdateOutputSchema = z.object({
  id: z.string().describe('A unique identifier for the update.'),
  title: z.string().describe('A concise title for the summarized amendment.'),
  summary: z.string().describe('A brief summary of the regulatory amendment.'),
  date: z.string().describe('The publication or effective date of the amendment (can be mocked for now).'),
  source: z.string().describe('The source of the regulatory update (e.g., "eCFR").'),
  link: z.string().describe('A link to the original source (can be "#" for now).'),
});
export type RegulatoryUpdateOutput = z.infer<typeof RegulatoryUpdateOutputSchema>;

export async function summarizeRegulatoryText(input: RegulatoryUpdateInput): Promise<RegulatoryUpdateOutput> {
  return regulatoryTextSummarizerFlow(input);
}

const regulatorySummarizationPrompt = ai.definePrompt({
  name: 'regulatorySummarizationPrompt',
  input: {schema: RegulatoryUpdateInputSchema},
  output: {schema: RegulatoryUpdateOutputSchema.omit({ id: true, date: true, link: true, source: true })}, // AI generates title and summary
  prompt: `
You are an expert legal AI assistant specializing in summarizing regulatory amendments.
Given the following amendment text, please provide a concise title and a brief summary highlighting the key changes or implications.

Amendment Text:
{{{amendmentText}}}

Please generate a suitable title and summary for this amendment.
Focus on clarity and conciseness. The summary should be understandable to a compliance professional.
Do not include the date, source, or link in your direct response; these will be added programmatically.
`,
});

const regulatoryTextSummarizerFlow = ai.defineFlow(
  {
    name: 'regulatoryTextSummarizerFlow',
    inputSchema: RegulatoryUpdateInputSchema,
    outputSchema: RegulatoryUpdateOutputSchema,
  },
  async (input) => {
    const { output } = await regulatorySummarizationPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate a summary for the regulatory text.');
    }

    // Mocking some fields that would come from the scraping/data processing step
    const currentDate = new Date();
    const mockDate = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
    
    return {
      id: crypto.randomUUID(), // Generate a unique ID
      title: output.title,
      summary: output.summary,
      date: mockDate,
      source: input.sourceName || 'eCFR Automated Summary',
      link: '#', // Placeholder link
    };
  }
);
