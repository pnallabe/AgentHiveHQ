
"use client";

import type { ChangeEvent, DragEvent } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useRef } from "react";
import { getRuleSenseAnalysis, type RuleSenseOutput } from "@/ai/flows/rulesense-flow";
import { Loader2, AlertTriangle, UploadCloud, FileText, XCircle } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  scenario: z.string().min(20, { message: "Please describe your scenario in at least 20 characters." }).max(5000, { message: "Scenario description cannot exceed 5000 characters." }),
});
type FormData = z.infer<typeof formSchema>;

const ALLOWED_FILE_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/xml", "text/xml"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function RuleSenseAppPage() {
  const [analysisResult, setAnalysisResult] = useState<RuleSenseOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { scenario: "" },
  });

  const handleFileValidation = (file: File | null): boolean => {
    if (!file) return true; // No file is also valid

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError(`Invalid file type. Allowed types: DOC, DOCX, PDF, XML. Got: ${file.type}`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return false;
    }
    setFileError(null);
    return true;
  };

  const handleFileSelect = (file: File | null) => {
    if (file && handleFileValidation(file)) {
      setUploadedFile(file);
    } else if (!file) {
      setUploadedFile(null);
      setFileError(null);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true); // Ensure dragging is true if an item is over
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
      e.dataTransfer.clearData();
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input
    }
  };


  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    if (uploadedFile && !handleFileValidation(uploadedFile)) {
      setIsLoading(false);
      return;
    }

    console.log("Scenario Data:", data);
    if (uploadedFile) {
      console.log("Uploaded File:", uploadedFile.name, uploadedFile.size, uploadedFile.type);
      // TODO: Implement file parsing and integration with AI flow
      // For now, the AI flow does not use the file, but you might want to read it as a data URI here
      // e.g. const fileDataUri = await new Promise((resolve, reject) => { ... });
    }

    try {
      // The current getRuleSenseAnalysis only takes scenarioDescription.
      // File data would need to be passed if the flow is updated.
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
            Describe your regulatory or compliance scenario below. You can also upload a relevant document for context.
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
                        rows={6}
                        className="text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel htmlFor="file-upload" className="text-lg">Upload Document (Optional)</FormLabel>
                <div
                  className={cn(
                    "mt-1 flex justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 transition-colors",
                    dragging ? "border-primary bg-primary/10" : "hover:border-muted-foreground/50",
                    fileError ? "border-destructive" : ""
                  )}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()} // Trigger file input on click
                >
                  <div className="text-center">
                    <UploadCloud className={cn("mx-auto h-12 w-12", dragging ? "text-primary" : "text-muted-foreground/70")} />
                    <p className="mt-4 text-sm text-muted-foreground">
                      <span className={cn("font-semibold", dragging ? "text-primary" : "text-accent")}>
                        {dragging ? "Drop your file here" : "Click to upload or drag and drop"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">DOC, DOCX, PDF, XML (Max 5MB)</p>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      ref={fileInputRef}
                      className="sr-only"
                      onChange={handleFileInputChange}
                      accept=".doc,.docx,.pdf,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/xml,text/xml"
                    />
                  </div>
                </div>
                {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
              </FormItem>

              {uploadedFile && !fileError && (
                <AnimatedSection className="mt-4">
                  <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                        {uploadedFile.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={handleRemoveFile}
                      aria-label="Remove file"
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>
                </AnimatedSection>
              )}

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

    