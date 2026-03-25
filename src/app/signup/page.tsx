
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { Eye, EyeOff, Chrome, CheckCircle2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Left brand panel
// ---------------------------------------------------------------------------

function BrandPanel() {
  const bullets = [
    "SHAP-powered explainability on every decision",
    "FCRA & SR 11-7 compliant audit logs",
    "Real-time model governance dashboard",
  ];

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

      <div className="space-y-6">
        <h2 className="text-2xl font-bold leading-snug text-zinc-100">
          Start making smarter credit decisions today.
        </h2>
        <ul className="space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-zinc-400">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-approve-base"
                aria-hidden
              />
              {b}
            </li>
          ))}
        </ul>
      </div>

      <p className="font-mono text-xs text-zinc-600">
        No credit card required · Free 14-day trial
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  // Email sign-up
  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("An account with that email already exists.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth
  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setError("Google sign-up failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-surface-base lg:grid-cols-2">
      <BrandPanel />

      {/* Right panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Logo href="/" size={28} showWordmark />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-100">Create an account</h1>
            <p className="text-sm text-zinc-500">
              Get started with AgentHive in seconds.
            </p>
          </div>

          {/* Google button */}
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-surface-border bg-surface-raised text-zinc-200 hover:bg-surface-overlay"
            onClick={handleGoogle}
            disabled={googleLoading || isLoading}
          >
            <Chrome className="h-4 w-4" aria-hidden />
            {googleLoading ? "Redirecting…" : "Sign up with Google"}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-border" />
            <span className="font-mono text-[10px] text-zinc-600">or</span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSignUp} className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-surface-overlay border-surface-border pr-10 text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-200 focus-visible:outline-none"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-zinc-300">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showCpw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-surface-overlay border-surface-border pr-10 text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowCpw((v) => !v)}
                  aria-label={showCpw ? "Hide confirm password" : "Show confirm password"}
                  className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-zinc-200 focus-visible:outline-none"
                >
                  {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-reject-base/30 bg-reject-muted px-3 py-2 text-sm text-reject-base">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading || googleLoading}
              className="w-full bg-brand-500 font-semibold text-white hover:bg-brand-600 focus-visible:ring-brand-500"
            >
              {isLoading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-xs text-zinc-600">
            By creating an account, you agree to our{" "}
            <Link href="/terms-of-service" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

