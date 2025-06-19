
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ExternalLink, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { RegulatoryUpdateInput, RegulatoryUpdateOutput } from "@/ai/flows/regulatory-update-flow";
import { summarizeRegulatoryText } from "@/ai/flows/regulatory-update-flow";
import { AnimatedSection } from "@/components/landing/animated-section";

// Placeholder texts that would normally come from a web scraper
const mockAmendmentTexts: RegulatoryUpdateInput[] = [
  {
    amendmentText: "The Federal Reserve Board on Tuesday finalized a rule that tailors the requirements of its stress testing rules for large domestic and foreign banks. The final rule, which is similar to the proposal issued in April 2024, aims to increase the efficiency of stress testing while maintaining its effectiveness in assessing capital adequacy. Key changes include adjustments to the frequency of company-run stress tests for certain firms and modifications to the global market shock component for firms with significant trading operations. The rule also clarifies certain modeling assumptions and enhances transparency.",
    sourceName: "Federal Reserve Board"
  },
  {
    amendmentText: "The Securities and Exchange Commission today adopted amendments to enhance and standardize disclosures regarding cybersecurity risk management, strategy, governance, and incident reporting by public companies. The amendments will require current reporting about material cybersecurity incidents. They also will require periodic disclosures about a registrant’s processes to assess, identify, and manage material cybersecurity risks, management's role in assessing and managing material cybersecurity risks, and the board of directors’ oversight of cybersecurity risks.",
    sourceName: "SEC"
  },
  {
    amendmentText: "The Consumer Financial Protection Bureau (CFPB) issued a new rule today aimed at curbing excessive credit card late fees. The rule, effective August 2025, generally prohibits issuers from charging late fees higher than $8 unless they can prove that higher fees are necessary to cover their collection costs. This is a significant reduction from the current average late fee of around $30. The CFPB estimates this change could save consumers more than $9 billion per year.",
    sourceName: "CFPB"
  }
];


export function RegulatoryIntelligenceWidget() {
  const [updates, setUpdates] = useState<RegulatoryUpdateOutput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndUpdateSummaries = async () => {
    setIsLoading(true);
    setError(null);
    setUpdates([]); // Clear previous updates

    try {
      const summarizedUpdates: RegulatoryUpdateOutput[] = [];
      // Simulate fetching and summarizing a few mock amendments
      for (const mockInput of mockAmendmentTexts) {
        // Introduce a small delay to simulate network latency and processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
        const result = await summarizeRegulatoryText(mockInput);
        summarizedUpdates.push(result);
      }
      // Sort by a mocked date (newest first, assuming flow provides current date)
      // For more robust sorting, the flow would need to return actual amendment dates
      summarizedUpdates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setUpdates(summarizedUpdates.slice(0, 3)); // Keep top 3
    } catch (err) {
      console.error("Error fetching regulatory summaries:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch regulatory updates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAndUpdateSummaries();
  }, []);

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center">
            <Newspaper className="mr-3 h-6 w-6 text-primary" />
            Regulatory Intelligence
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchAndUpdateSummaries} disabled={isLoading} aria-label="Refresh updates">
            <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>AI-summarized highlights of recent regulatory changes. (Simulated data)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <AnimatedSection className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p>Fetching latest summaries...</p>
          </AnimatedSection>
        )}
        {error && !isLoading && (
          <AnimatedSection className="flex flex-col items-center justify-center h-40 text-destructive">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Error loading updates</p>
            <p className="text-sm text-center">{error}</p>
            <Button variant="link" onClick={fetchAndUpdateSummaries} className="mt-2">Try Again</Button>
          </AnimatedSection>
        )}
        {!isLoading && !error && updates.length === 0 && (
           <AnimatedSection className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Newspaper className="h-8 w-8 mb-2" />
            <p>No regulatory updates available at the moment.</p>
          </AnimatedSection>
        )}
        {!isLoading && !error && updates.map((update) => (
          <AnimatedSection key={update.id} className="border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-md text-foreground mb-1">{update.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{update.summary}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground/80">
              <span>{update.source} - {update.date}</span>
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                <Link href={update.link} target="_blank" rel="noopener noreferrer">
                  Read More <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </AnimatedSection>
        ))}
         <div className="pt-2 text-center text-xs text-muted-foreground">
            Note: Data is AI-summarized & simulated. Actual scraping of eCFR requires a backend process.
        </div>
      </CardContent>
    </Card>
  );
}
