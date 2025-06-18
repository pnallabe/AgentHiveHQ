
"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { getRuleSenseAnalysis, type RuleSenseOutput } from "@/ai/flows/rulesense-flow";
import { Loader2, AlertTriangle } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

const formSchema = z.object({
  scenario: z.string().min(20, { message: "Please describe your scenario in at least 20 characters." }).max(5000, { message: "Scenario description cannot exceed 5000 characters." }),
});
type FormData = z.infer<typeof formSchema>;

export default function RuleSenseAppPage() {
  const [analysisResult, setAnalysisResult] = useState<RuleSenseOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { scenario: "" },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const result = await getRuleSenseAnalysis({ scenarioDescription: data.scenario });
      setAnalysisResult(result);
    } catch (err) {
      console.error("Error getting RuleSense analysis:", err);
      setError(err instanceof Error ? err.message : "Failed to get analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <AnimatedSection className="text-center mb-10">
          <h1 className="font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl">
            RuleSense AI Assistant
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Describe your regulatory or compliance scenario below, and our AI will provide a tailored analysis.
          </p>
        </AnimatedSection>

        <Card className="rounded-xl bg-card p-6 shadow-xl sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="scenario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="scenario" className="text-lg">Your Scenario</FormLabel>
                    <FormControl>
                      <Textarea
                        id="scenario"
                        placeholder="e.g., 'I am launching a new fintech app in California that handles user payments. What are the key compliance steps I need to consider for data privacy and financial regulations?'"
                        rows={8}
                        className="text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  "Get AI Analysis"
                )}
              </Button>
            </form>
          </Form>
        </Card>

        {isLoading && (
          <AnimatedSection className="mt-8 text-center">
            <div className="flex justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">AI is thinking...</p>
            </div>
          </AnimatedSection>
        )}

        {error && !isLoading && (
          <AnimatedSection className="mt-8">
            <Card className="border-destructive bg-destructive/10 p-4 rounded-lg">
              <div className="flex items-center text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            </Card>
          </AnimatedSection>
        )}

        {analysisResult && !isLoading && (
          <AnimatedSection className="mt-10 space-y-8">
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">AI Analysis Summary</CardTitle>
                {analysisResult.scenarioSummary && (
                    <CardDescription className="pt-2">{analysisResult.scenarioSummary}</CardDescription>
                )}
              </CardHeader>
            </Card>
            
            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle>Compliance Checklist</CardTitle>
              </CardHeader>
              <CardContent>
                {analysisResult.complianceChecklist && analysisResult.complianceChecklist.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                    {analysisResult.complianceChecklist.map((item, index) => (
                      <li key={`checklist-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No checklist items provided.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle>Relevant Citations</CardTitle>
              </CardHeader>
              <CardContent>
                {analysisResult.relevantCitations && analysisResult.relevantCitations.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                    {analysisResult.relevantCitations.map((item, index) => (
                      <li key={`citation-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No citations provided.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-lg">
              <CardHeader>
                <CardTitle>Actionable Guidance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.actionableGuidance || "No guidance provided."}</p>
              </CardContent>
            </Card>

            {analysisResult.potentialRisks && analysisResult.potentialRisks.length > 0 && (
              <Card className="rounded-xl shadow-lg border-amber-500/50 bg-amber-500/10">
                <CardHeader>
                  <CardTitle className="text-amber-700 dark:text-amber-400">Potential Risks</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-2 pl-5 text-amber-600 dark:text-amber-300">
                    {analysisResult.potentialRisks.map((item, index) => (
                      <li key={`risk-${index}`}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </AnimatedSection>
        )}
      </main>
      <Footer />
    </div>
  );
}
