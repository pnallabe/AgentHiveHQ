
'use server';
/**
 * @fileOverview A Genkit flow for RuleSense AI to analyze compliance scenarios,
 * or answer questions based on an uploaded document's content, and provide summaries.
 *
 * - getRuleSenseAnalysis - A function that handles the RuleSense analysis process.
 * - RuleSenseInput - The input type for the getRuleSenseAnalysis function.
 * - RuleSenseOutput - The return type for the getRuleSenseAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RuleSenseInputSchema = z.object({
  scenarioDescription: z.string().describe("A detailed description of the user's regulatory/compliance scenario, or a specific question about an uploaded document."),
  documentContext: z.string().optional().describe('Optional textual content of an uploaded document (from .txt or parsed .pdf) or a string like "Content of document: filename.ext" or "Error reading content of document: filename.ext" (for .doc, .docx, .xml, or if .txt/.pdf parsing failed) to be considered.'),
});
export type RuleSenseInput = z.infer<typeof RuleSenseInputSchema>;

const RuleSenseOutputSchema = z.object({
  scenarioSummary: z.string().describe("A brief summary of the AI's understanding of the user's scenario or question."),
  complianceChecklist: z.array(z.string()).describe('A step-by-step compliance checklist (may be N/A if query is document-specific).'),
  relevantCitations: z.array(z.string()).describe('Relevant legal or regulatory citations (may be N/A if query is document-specific).'),
  actionableGuidance: z.string().describe('Clear, actionable guidance, or the answer to a document-specific question based on its content, or the answer to a general query if no document is provided.'),
  potentialRisks: z.array(z.string()).optional().describe('Potential risks or areas of concern (may be N/A if query is document-specific).'),
  documentSummary: z.string().optional().describe('A concise summary of the provided document context. If full content cannot be processed, this will acknowledge the file and state the limitation (e.g., content parsing failed, or file type not yet supported for full content processing).'),
});
export type RuleSenseOutput = z.infer<typeof RuleSenseOutputSchema>;

export async function getRuleSenseAnalysis(input: RuleSenseInput): Promise<RuleSenseOutput> {
  return ruleSenseAnalysisFlow(input);
}

const ruleSensePrompt = ai.definePrompt({
  name: 'ruleSenseCompliancePrompt',
  input: { schema: RuleSenseInputSchema },
  output: { schema: RuleSenseOutputSchema },
  prompt: `You are RuleSense, an expert AI assistant.
Your primary goal is to assist users with their regulatory and compliance scenarios OR answer questions based on an uploaded document.

**DOCUMENT PROCESSING AND Q&A INSTRUCTIONS (VERY IMPORTANT):**

{{#if documentContext}}
  A document context has been provided.
  User's Query (interpret as a question about the document if the document's full text is available, otherwise as a general scenario):
  {{{scenarioDescription}}}

  Provided Document Context:
  {{{documentContext}}}

  **Determine if the "Provided Document Context" is full text or a placeholder/error message:**
  *   **Full Text Indicators**: The context is likely full text if it's long, contains multiple sentences, paragraphs, or typical document language. It might have originated from a .txt file or a successfully parsed .pdf file.
  *   **Placeholder/Error Indicators**: The context is likely a placeholder or error if it's short and matches patterns like "Content of document: filename.ext" OR "Error reading content of document: filename.ext" OR "Content of document: filename.pdf (Error parsing content)".

  **Scenario A: "Provided Document Context" appears to be FULL TEXT (from .txt or successfully parsed .pdf)**
  If the "Provided Document Context" appears to be the actual textual content of a document:
    1.  **Primary Task**: Your main goal is to answer the "User's Query" STRICTLY based on the information contained within the 'Provided Document Context'.
    2.  **Source Limitation**: Do NOT use any external knowledge or information outside of the 'Provided Document Context' to answer the query. If the answer is not found in the document, explicitly state that.
    3.  **Output - \`actionableGuidance\`**: This field MUST contain your detailed answer to the "User's Query", derived solely from the document.
    4.  **Output - \`scenarioSummary\`**: Briefly summarize/rephrase the "User's Query".
    5.  **Output - \`documentSummary\`**: Provide a concise summary of the 'Provided Document Context' itself.
    6.  **Output - \`complianceChecklist\`, \`relevantCitations\`, \`potentialRisks\`**:
        *   If the "User's Query" is clearly asking for information *from* the document (e.g., "What does section 3 say about X?"), populate these fields with a message like "N/A - Query is specific to the provided document content."
        *   If the document *itself* contains compliance information and the "User's Query" is related to that, you MAY populate these fields based on the document's content. Use your judgment.

  **Scenario B: "Provided Document Context" appears to be a PLACEHOLDER or ERROR MESSAGE**
  If the "Provided Document Context" looks like "Content of document: filename.ext", "Error reading content of document: filename.ext", or "Content of document: filename.pdf (Error parsing content)":
    1.  **Identify File Type and Status**: Note the filename and any error messages (e.g., ".pdf (Error parsing content)", ".txt (Error reading content)", ".doc", ".docx", ".xml").
    2.  **Output - \`actionableGuidance\`**:
        *   For ".pdf (Error parsing content)" or ".txt (Error reading content)": State that content extraction for the mentioned file failed, so specific Q&A on its content isn't possible. If the "User's Query" can be interpreted as a general compliance scenario, address it generally.
        *   For ".doc", ".docx", or ".xml" (where only filename is provided): Clearly state that you cannot answer questions based on the specific content of the file because direct content processing and Q&A for these file types (DOC, DOCX, XML) are currently in development. However, if the "User's Query" can be interpreted as a general compliance scenario independent of the document's specific content, you may address it generally.
    3.  **Output - \`documentSummary\`**: Acknowledge the document by its name and type (e.g., "The document 'report.pdf' has been noted."). Clearly state the limitation: "Content extraction failed for this file." OR "Direct content analysis, summarization, and question-answering for DOC/DOCX/XML file types are currently in development. I cannot access its content." Do NOT attempt to guess or summarize content based on filename alone.
    4.  **Output - \`scenarioSummary\`, \`complianceChecklist\`, \`relevantCitations\`, \`potentialRisks\`**: Address the "User's Query" as a general compliance query if possible. Note that the specific content of the mentioned document could not be used for a more detailed analysis due to the stated limitations.

{{else}}
  No document context has been provided.
  User's Scenario:
  {{{scenarioDescription}}}

  **Task**: Provide a comprehensive compliance analysis based on the "User's Scenario".
  1.  **Output - \`scenarioSummary\`**: Briefly summarize your understanding of the user's situation or question.
  2.  **Output - \`complianceChecklist\`**: Generate a detailed, step-by-step checklist of compliance actions relevant to the scenario.
  3.  **Output - \`relevantCitations\`**: List key legal acts, regulations, or standards that apply to the scenario.
  4.  **Output - \`actionableGuidance\`**: Provide the answer to the user's query or clear advice on how the user should proceed based on their described scenario.
  5.  **Output - \`potentialRisks\` (Optional but Recommended)**: Highlight any potential risks or areas of concern related to the scenario.
  6.  **Output - \`documentSummary\`**: Omit this field or leave it empty, as no document was provided.
{{/if}}

Present your response in the structured JSON format defined by the output schema. Ensure all text is clear and professional.
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

