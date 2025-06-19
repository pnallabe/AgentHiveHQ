
'use server';
/**
 * @fileOverview A Genkit flow for RuleSense AI to analyze compliance scenarios,
 * answer questions based on an uploaded document's content, provide summaries,
 * and generate draft policy documents.
 *
 * - getRuleSenseAnalysis - A function that handles the RuleSense analysis process.
 * - RuleSenseInput - The input type for the getRuleSenseAnalysis function.
 * - RuleSenseOutput - The return type for the getRuleSenseAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RuleSenseInputSchema = z.object({
  scenarioDescription: z.string().describe("A detailed description of the user's regulatory/compliance scenario, a specific question about an uploaded document, or a request for a policy document."),
  documentContext: z.string().optional().describe('Optional textual content of an uploaded document (from .txt or parsed .pdf) or a string like "Content of document: filename.ext" or "Error reading content of document: filename.ext" (for .doc, .docx, .xml, or if .txt/.pdf parsing failed) to be considered.'),
});
export type RuleSenseInput = z.infer<typeof RuleSenseInputSchema>;

const RuleSenseOutputSchema = z.object({
  scenarioSummary: z.string().describe("A brief summary of the AI's understanding of the user's scenario or question."),
  complianceChecklist: z.array(z.string()).optional().describe('A step-by-step compliance checklist (may be N/A if query is document-specific or for policy generation).'),
  relevantCitations: z.array(z.string()).optional().describe('Relevant legal or regulatory citations (may be N/A if query is document-specific or for policy generation).'),
  actionableGuidance: z.string().describe('Clear, actionable guidance, the answer to a document-specific question based on its content, the answer to a general query, or context for a generated policy.'),
  potentialRisks: z.array(z.string()).optional().describe('Potential risks or areas of concern (may be N/A if query is document-specific or for policy generation).'),
  documentSummary: z.string().optional().describe('A concise summary of the provided document context. If full content cannot be processed, this will acknowledge the file and state the limitation.'),
  generatedPolicyDocument: z.string().optional().describe('A draft policy document generated based on the user query, focusing on compliance. Should clearly state it is a DRAFT and requires legal review.'),
});
export type RuleSenseOutput = z.infer<typeof RuleSenseOutputSchema>;

export async function getRuleSenseAnalysis(input: RuleSenseInput): Promise<RuleSenseOutput> {
  return ruleSenseAnalysisFlow(input);
}

const ruleSensePrompt = ai.definePrompt({
  name: 'ruleSenseCompliancePrompt',
  input: { schema: RuleSenseInputSchema },
  output: { schema: RuleSenseOutputSchema },
  prompt: `You are RuleSense, an expert AI assistant for regulatory and compliance matters.
Your tasks include:
1.  Analyzing compliance scenarios.
2.  Answering questions based on uploaded document content.
3.  Generating draft policy documents based on user requests.

User's Query: {{{scenarioDescription}}}

{{#if documentContext}}
  Provided Document Context: {{{documentContext}}}
  **DOCUMENT PROCESSING AND Q&A INSTRUCTIONS:**
  Determine if the "Provided Document Context" is full text or a placeholder/error message:
  *   **Full Text Indicators**: Long text, multiple sentences/paragraphs (from .txt or successfully parsed .pdf).
  *   **Placeholder/Error Indicators**: Short messages like "Content of document: filename.ext", "Error reading content...", or ".pdf (Error parsing content)".

  **Scenario A: "Provided Document Context" appears to be FULL TEXT (from .txt or successfully parsed .pdf)**
    1.  **Primary Task**: Answer the "User's Query" STRICTLY based on the 'Provided Document Context'.
    2.  **Source Limitation**: Do NOT use external knowledge. If the answer isn't in the document, state that.
    3.  **Output - \`actionableGuidance\`**: Your detailed answer to the "User's Query", derived from the document.
    4.  **Output - \`scenarioSummary\`**: Rephrase the "User's Query".
    5.  **Output - \`documentSummary\`**: Concisely summarize the 'Provided Document Context'.
    6.  **Output - \`complianceChecklist\`, \`relevantCitations\`, \`potentialRisks\`, \`generatedPolicyDocument\`**: Populate with "N/A - Query is specific to the provided document content." unless the document itself contains such information relevant to the query. Do not generate a new policy if the query is about an existing document's content.

  **Scenario B: "Provided Document Context" appears to be a PLACEHOLDER or ERROR MESSAGE**
    1.  **Identify File Type and Status**: Note filename and errors.
    2.  **Output - \`actionableGuidance\`**:
        *   For ".pdf (Error parsing content)" or ".txt (Error reading content)": State content extraction failed, so specific Q&A isn't possible. If "User's Query" can be general, address it generally.
        *   For ".doc", ".docx", ".xml": State that direct content processing/Q&A for these types is in development. If "User's Query" is general, address it generally.
    3.  **Output - \`documentSummary\`**: Acknowledge the document (e.g., "'report.pdf' noted.") and state the limitation (e.g., "Content extraction failed." or "Direct content analysis for DOC/DOCX/XML is in development.").
    4.  **Output - \`generatedPolicyDocument\`**: Set to "N/A - Cannot generate policy based on filename alone for this file type." or similar if a policy was requested but document content is unavailable.
    5.  **General Query/Policy Generation (If applicable even with placeholder document):**
        If the "User's Query" *also* contains a request for a general compliance analysis or policy generation that can be addressed *independently* of the (unprocessed) document content, proceed with the "NO DOCUMENT CONTEXT / POLICY GENERATION" instructions below for relevant fields, but ensure \`documentSummary\` reflects the placeholder status.

{{else}}
  **NO DOCUMENT CONTEXT / POLICY GENERATION INSTRUCTIONS:**
  No document context has been provided. Analyze the "User's Query".

  **Task 1: Determine if the user is requesting a POLICY DOCUMENT.**
  Look for explicit requests like "create a policy for...", "draft a policy on...", "what should our policy say about...", "generate a policy document that addresses..."
  If a policy document is requested:
    1.  **Output - \`generatedPolicyDocument\`**: Generate a DRAFT policy document.
        *   Structure: Title, Purpose, Scope, Key Policy Statements (addressing the user's query/issue), Responsibilities, Enforcement/Compliance, Disclaimer.
        *   **Disclaimer (CRITICAL):** The generated policy MUST include a clear statement like: "This is a DRAFT document generated by an AI assistant for informational purposes only. It is NOT a substitute for professional legal advice. Consult with qualified legal counsel to ensure compliance with all applicable laws and regulations before implementation."
    2.  **Output - \`actionableGuidance\`**: Provide a brief explanation of the generated policy or highlight key aspects. Mention that a draft policy has been generated.
    3.  **Output - \`scenarioSummary\`**: Summarize the user's request for a policy.
    4.  **Output - \`complianceChecklist\`, \`relevantCitations\`, \`potentialRisks\`**: These can be general points related to the policy's subject matter if appropriate, or marked "N/A - Focus is on policy generation."
    5.  **Output - \`documentSummary\`**: Omit or leave empty.

  **Task 2: If NOT requesting a policy, perform GENERAL COMPLIANCE ANALYSIS.**
    1.  **Output - \`scenarioSummary\`**: Summarize your understanding of the user's situation or question.
    2.  **Output - \`complianceChecklist\`**: Generate a detailed, step-by-step checklist of compliance actions relevant to the scenario.
    3.  **Output - \`relevantCitations\`**: List key legal acts, regulations, or standards.
    4.  **Output - \`actionableGuidance\`**: Provide the answer to the user's query or clear advice.
    5.  **Output - \`potentialRisks\` (Recommended)**: Highlight potential risks.
    6.  **Output - \`documentSummary\`, \`generatedPolicyDocument\`**: Omit or leave empty.
{{/if}}

Present your response in the structured JSON format defined by the output schema. Ensure all text is clear, professional, and accurate.
Prioritize user's explicit instructions if they ask for a specific format or type of output.
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
    // Ensure optional arrays are initialized if not present, to avoid undefined errors in UI
    output.complianceChecklist = output.complianceChecklist || [];
    output.relevantCitations = output.relevantCitations || [];
    output.potentialRisks = output.potentialRisks || [];
    return output;
  }
);

