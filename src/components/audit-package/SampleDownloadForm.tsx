"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Download, Loader2 } from "lucide-react";

/**
 * Gated-download form — emails the sample SR 11-7 audit package to the
 * prospect via POST /api/v1/sample-audit-package. Captures the lead in the
 * same tenant-inquiries pipeline (referral=audit-package-download).
 */
export function SampleDownloadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !company.trim()) {
      setError("All three fields are required.");
      return;
    }
    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    try {
      const res = await fetch(`${apiUrl}/api/v1/sample-audit-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        setError("Something went wrong — please try again or email us directly.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-teal-500/30 bg-teal-500/5 px-6 py-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-teal-400" aria-hidden />
        <p className="font-heading text-lg font-semibold text-zinc-100">
          Check your inbox.
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          The sample Model Validation Report is on its way to{" "}
          <span className="text-zinc-200">{email}</span>. Reply to that email if
          you&apos;d like to see it generated from a live tenant.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md space-y-3 text-left"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          type="text"
          placeholder="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500"
        />
        <Input
          type="text"
          placeholder="Company"
          autoComplete="organization"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500"
        />
      </div>
      <Input
        type="email"
        placeholder="Work email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button
        type="submit"
        size="lg"
        disabled={isLoading}
        className="h-11 w-full bg-brand-500 px-6 text-white hover:bg-brand-600"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Email Me the Sample Package
          </>
        )}
      </Button>
      <p className="text-center font-mono text-[11px] text-zinc-600">
        Synthetic demo data. No spam — one email, that&apos;s it.
      </p>
    </form>
  );
}
