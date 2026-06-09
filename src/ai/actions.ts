"use server";

import { executiveBriefFlow, type ExecutiveBriefInput, type ExecutiveBriefOutput } from "@/ai/flows/executive-brief-flow";
import { regulatoryTextSummarizerFlow, type RegulatoryUpdateInput, type RegulatoryUpdateOutput } from "@/ai/flows/regulatory-update-flow";

export async function generateExecutiveBrief(input: ExecutiveBriefInput): Promise<ExecutiveBriefOutput> {
  return executiveBriefFlow(input);
}

export async function summarizeRegulatoryText(input: RegulatoryUpdateInput): Promise<RegulatoryUpdateOutput> {
  return regulatoryTextSummarizerFlow(input);
}
