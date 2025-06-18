
"use client";

import type { ChangeEvent, DragEvent } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useRef } from "react";
import { getRuleSenseAnalysis, type RuleSenseOutput, type RuleSenseInput } from "@/ai/flows/rulesense-flow";
import { Loader2, AlertTriangle, UploadCloud, FileText, XCircle, FileSearch } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  scenario: z.string().min(20, { message: "Please describe your scenario or question in at least 20 characters." }).max(5000, { message: "Scenario/question description cannot exceed 5000 characters." }),
});
type FormData = z.infer<typeof formSchema>;

const ALLOWED_FILE_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/xml", "text/xml", "text/plain"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function RuleSenseAppPage() {
  const [analysisResult, setAnalysisResult] = useState<RuleSenseOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [dragging, setDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { scenario: "" },
  });

  const handleFileValidation = (file: File | null): boolean => {
    if (!file) return true; 

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError(`Invalid file type. Allowed: DOC, DOCX, PDF, XML, TXT. Got: ${file.type}`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
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
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
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
      fileInputRef.current.value = ""; 
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    if (uploadedFile && !handleFileValidation(uploadedFile)) {
      setIsLoading(false);
      return;
    }

    let documentContext: string | undefined = undefined;

    if (uploadedFile) {
      console.log("Uploaded File:", uploadedFile.name, uploadedFile.size, uploadedFile.type);
      if (uploadedFile.type === "text/plain") {
        try {
          documentContext = await readFileAsText(uploadedFile);
        } catch (readError) {
          console.error("Error reading text file:", readError);
          setFileError("Could not read the content of the text file.");
          documentContext = `Content of document: ${uploadedFile.name} (Error reading content)`; // Fallback
        }
      } else {
        documentContext = `Content of document: ${uploadedFile.name}`;
      }
    }
    
    const aiInput: RuleSenseInput = {
      scenarioDescription: data.scenario,
    };
    if (documentContext) {
      aiInput.documentContext = documentContext;
    }

    try {
      const result = await getRuleSenseAnalysis(aiInput);
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
            Describe your scenario or ask a question about an uploaded document. 
            You can drag & drop or upload a document (TXT, PDF, DOC, DOCX, XML) for context.
          </p>
        </AnimatedSection>

        <Card 
          className={cn(
            "rounded-xl bg-card p-6 shadow-xl sm:p-8 transition-all",
            dragging ? "border-2 border-primary ring-2 ring-primary/50" : "border",
            fileError ? "border-destructive" : ""
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="scenario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="scenario" className="text-lg">Your Scenario / Question about the Document</FormLabel>
                    <FormControl>
                      <Textarea
                        id="scenario"
                        placeholder="e.g., 'I am launching a new fintech app...' OR 'What are the key data retention policies mentioned in the uploaded document?'"
                        rows={6}
                        className="text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!uploadedFile && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 text-center cursor-pointer transition-colors hover:border-muted-foreground/50",
                    dragging ? "border-primary bg-primary/10" : "",
                    fileError ? "border-destructive" : ""
                  )}
                >
                  <UploadCloud className={cn("mx-auto h-12 w-12", dragging ? "text-primary" : "text-muted-foreground/70")} />
                  <p className="mt-4 text-sm text-muted-foreground">
                    <span className={cn("font-semibold", dragging ? "text-primary" : "text-accent")}>
                      {dragging ? "Drop file to attach" : "Drag & drop document or click to upload"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">TXT, PDF, DOC, DOCX, XML (Max 5MB)</p>
                </div>
              )}
              <input
                id="file-upload-integrated"
                name="file-upload-integrated"
                type="file"
                ref={fileInputRef}
                className="sr-only"
                onChange={handleFileInputChange}
                accept=".doc,.docx,.pdf,.xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/xml,text/xml,.txt,text/plain"
              />
              {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}

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
              <CardContent className="p-0"> 
                <div className="flex items-center text-destructive">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p className="font-medium">{error}</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>
        )}

        {analysisResult && !isLoading && (
          <AnimatedSection className="mt-10 space-y-8">
            <Card className="rounded-xl shadow-lg">
               <CardContent className="p-6"> 
                <h2 className="text-2xl font-semibold text-primary mb-2">AI Analysis of Your Query</h2>
                {analysisResult.scenarioSummary ? (
                    <p className="text-muted-foreground pt-2">{analysisResult.scenarioSummary}</p>
                ) : (
                    <p className="text-muted-foreground pt-2">No summary of your query provided.</p>
                )}
              </CardContent>
            </Card>

            {analysisResult.documentSummary && (
              <Card className="rounded-xl shadow-lg bg-secondary/50">
                <CardContent className="p-6">
                  <div className="flex items-center mb-3">
                    <FileSearch className="h-6 w-6 text-accent mr-2" />
                    <h3 className="text-xl font-semibold text-foreground">Document Summary / Status</h3>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.documentSummary}</p>
                </CardContent>
              </Card>
            )}
            
            <Card className="rounded-xl shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">AI Guidance / Answer</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{analysisResult.actionableGuidance || "No specific guidance or answer provided."}</p>
              </CardContent>
            </Card>
            
            {analysisResult.complianceChecklist && analysisResult.complianceChecklist.length > 0 && !(analysisResult.complianceChecklist.length === 1 && analysisResult.complianceChecklist[0].toLowerCase().startsWith("n/a")) && (
            <Card className="rounded-xl shadow-lg">
              <CardContent className="p-6">
                 <h3 className="text-xl font-semibold text-foreground mb-3">Compliance Checklist</h3>
                  <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                    {analysisResult.complianceChecklist.map((item, index) => (
                      <li key={`checklist-${index}`}>{item}</li>
                    ))}
                  </ul>
              </CardContent>
            </Card>
            )}

            {analysisResult.relevantCitations && analysisResult.relevantCitations.length > 0 && !(analysisResult.relevantCitations.length === 1 && analysisResult.relevantCitations[0].toLowerCase().startsWith("n/a")) && (
            <Card className="rounded-xl shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground mb-3">Relevant Citations</h3>
                  <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                    {analysisResult.relevantCitations.map((item, index) => (
                      <li key={`citation-${index}`}>{item}</li>
                    ))}
                  </ul>
              </CardContent>
            </Card>
            )}


            {analysisResult.potentialRisks && analysisResult.potentialRisks.length > 0 && !(analysisResult.potentialRisks.length === 1 && analysisResult.potentialRisks[0].toLowerCase().startsWith("n/a")) && (
              <Card className="rounded-xl shadow-lg border-amber-500/50 bg-amber-500/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-amber-700 dark:text-amber-400 mb-3">Potential Risks</h3>
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

    