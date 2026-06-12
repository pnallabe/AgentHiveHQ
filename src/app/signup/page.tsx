"use client";

import { Suspense, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// TODO: replace with helixdecisions.ai Calendly link
const DEMO_BOOKING_URL = "https://calendly.com/helixdecisions/demo";

const VOLUME_OPTIONS = [
  { value: "", label: "Select volume…" },
  { value: "<500", label: "< 500" },
  { value: "500-5k", label: "500 – 5 k" },
  { value: "5k-50k", label: "5 k – 50 k" },
  { value: "50k+", label: "50 k+" },
];

// ---------------------------------------------------------------------------
// Left brand panel
// ---------------------------------------------------------------------------

function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 px-12 py-12 lg:flex">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(51,102,244,0.25) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <Logo size={32} showWordmark />

      <div className="space-y-4">
        <blockquote className="text-2xl font-bold leading-snug text-zinc-100">
          Join lending teams making smarter, fairer credit decisions with Helix Decisions.
        </blockquote>
        <p className="font-mono text-sm text-zinc-500">
          FCRA · SR 11-7 · SHAP explainability · ISO 8601 audit logs
        </p>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-xs text-zinc-600">Trusted by lending teams at scale</p>
        <div className="flex gap-6 font-mono text-xs text-zinc-500">
          <span>$2.4B+ evaluated</span>
          <span>99.98% uptime</span>
          <span>SOC 2 ready</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation state
// ---------------------------------------------------------------------------

function ConfirmationState() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-approve-base" aria-hidden />
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-100">Thanks — we&apos;ll be in touch.</h2>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          Our team reviews every request and typically responds within 1 business
          day. In the meantime, you can book a demo below.
        </p>
      </div>
      <Button
        asChild
        size="lg"
        className="h-11 bg-brand-500 px-6 text-white hover:bg-brand-600 focus-visible:ring-brand-500"
      >
        <a href={DEMO_BOOKING_URL} target="_blank" rel="noreferrer">
          Book a Demo
        </a>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interest form
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  email: string;
  company: string;
  title: string;
  useCase: string;
  volume: string;
  referral: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  company: "",
  title: "",
  useCase: "",
  volume: "",
  referral: "",
};

function TenantInterestForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set =
    (field: keyof FormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = "Full name is required.";
    if (!form.email.trim()) {
      next.email = "Work email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!form.company.trim()) next.company = "Company name is required.";
    if (!form.useCase.trim()) {
      next.useCase = "Use case is required.";
    } else if (form.useCase.length > 500) {
      next.useCase = "Maximum 500 characters.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/v1/tenant-inquiries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim(),
            title: form.title.trim() || undefined,
            useCase: form.useCase.trim(),
            volume: form.volume || undefined,
            referral: form.referral.trim() || undefined,
          }),
        });

        if (res.ok) {
          setSubmitted(true);
          setIsLoading(false);
          return;
        }

        const body = await res.json().catch(() => ({}));
        console.error("tenant-inquiries POST failed", { statusCode: res.status, body });
      } catch (err) {
        console.error("tenant-inquiries POST network error", err);
      }
    }

    // Fallback: mailto link
    setIsLoading(false);
    const subject = encodeURIComponent("Helix Decisions — Tenant Inquiry");
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company}\nTitle: ${form.title}\nUse Case: ${form.useCase}\nVolume: ${form.volume}\nReferral: ${form.referral}`
    );
    setSubmitError(`mailto:hello@helixdecisions.ai?subject=${subject}&body=${body}`);
  }

  if (submitted) return <ConfirmationState />;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-zinc-300">
          Full name <span aria-hidden className="text-red-400">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Jane Smith"
          autoComplete="name"
          value={form.name}
          onChange={set("name")}
          required
          className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
        />
        {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-zinc-300">
          Work email <span aria-hidden className="text-red-400">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          required
          className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
        />
        {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
      </div>

      {/* Company + Title row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="company" className="text-zinc-300">
            Company <span aria-hidden className="text-red-400">*</span>
          </Label>
          <Input
            id="company"
            type="text"
            placeholder="Acme Lending"
            value={form.company}
            onChange={set("company")}
            required
            className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
          {errors.company && <p className="text-xs text-red-400">{errors.company}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-zinc-300">Job title</Label>
          <Input
            id="title"
            type="text"
            placeholder="Head of Risk"
            value={form.title}
            onChange={set("title")}
            className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
      </div>

      {/* Use case */}
      <div className="space-y-1.5">
        <Label htmlFor="use-case" className="text-zinc-300">
          Describe your lending product and how you plan to use Helix Decisions.{" "}
          <span aria-hidden className="text-red-400">*</span>
        </Label>
        <textarea
          id="use-case"
          placeholder="We operate a BNPL product for e-commerce and want to use Helix Decisions for real-time underwriting…"
          value={form.useCase}
          onChange={set("useCase")}
          required
          maxLength={500}
          rows={4}
          className="w-full rounded-md bg-surface-overlay border border-surface-border px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 resize-none"
        />
        <p className="text-right font-mono text-[10px] text-zinc-600">{form.useCase.length}/500</p>
        {errors.useCase && <p className="text-xs text-red-400">{errors.useCase}</p>}
      </div>

      {/* Volume */}
      <div className="space-y-1.5">
        <Label htmlFor="volume" className="text-zinc-300">Monthly application volume</Label>
        <select
          id="volume"
          value={form.volume}
          onChange={set("volume")}
          className="w-full rounded-md bg-surface-overlay border border-surface-border px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
        >
          {VOLUME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Referral */}
      <div className="space-y-1.5">
        <Label htmlFor="referral" className="text-zinc-300">How did you hear about us?</Label>
        <Input
          id="referral"
          type="text"
          placeholder="LinkedIn, conference, colleague…"
          value={form.referral}
          onChange={set("referral")}
          className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
        />
      </div>

      {/* Mailto fallback */}
      {submitError && submitError.startsWith("mailto:") && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Could not submit automatically.{" "}
          <a href={submitError} className="underline hover:text-amber-100">
            Click here to send via email
          </a>{" "}
          instead.
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500"
      >
        {isLoading ? "Submitting…" : "Request Access"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-zinc-600">
        We do not offer self-serve signup. All tenants are onboarded by our team to
        ensure compliance and a smooth integration.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <SignUpPageContent />
    </Suspense>
  );
}

function SignUpPageContent() {
  return (
    <div className="grid min-h-screen bg-surface-base lg:grid-cols-2">
      <BrandPanel />

      {/* Right panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Logo href="/" size={28} showWordmark />
        </div>

        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-100">Request access</h1>
            <p className="text-sm text-zinc-500">
              Tell us about your lending product and we&apos;ll be in touch within 1 business day.
            </p>
          </div>

          <TenantInterestForm />

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-400 underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
