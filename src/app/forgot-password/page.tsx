
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: any) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/invalid-email"
      ) {
        setError("No account found with that email address.");
      } else {
        setError("Failed to send reset link. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo href="/" size={28} showWordmark />
        </div>

        {sent ? (
          /* ----------------------------------------------------------------
           * Success state
           * -------------------------------------------------------------- */
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-approve-muted">
                <MailCheck className="h-6 w-6 text-approve-base" aria-hidden />
              </span>
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-zinc-100">Check your email</h1>
              <p className="text-sm text-zinc-500">
                We&apos;ve sent a password reset link to{" "}
                <span className="font-mono text-zinc-300">{email}</span>.
              </p>
            </div>
            <p className="text-xs text-zinc-600">
              Didn&apos;t receive it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
              >
                try again
              </button>
              .
            </p>
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to sign in
            </Link>
          </div>
        ) : (
          /* ----------------------------------------------------------------
           * Reset form
           * -------------------------------------------------------------- */
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-zinc-100">
                Reset your password
              </h1>
              <p className="text-sm text-zinc-500">
                Enter your email and we&apos;ll send a reset link.
              </p>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-reject-base/30 bg-reject-muted px-3 py-2 text-sm text-reject-base">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand-500 font-semibold text-white hover:bg-brand-600 focus-visible:ring-brand-500"
              >
                {isLoading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

