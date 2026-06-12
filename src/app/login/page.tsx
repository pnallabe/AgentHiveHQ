
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { redirectUserToCrp, sanitizeNextPath } from "@/lib/crp-routing";

function resolveGoogleError(err: any): string {
  switch (err?.code) {
    case "auth/unauthorized-domain":
      return `This domain is not authorized for Google sign-in. Go to Firebase Console → Authentication → Settings → Authorized domains and add "${typeof window !== "undefined" ? window.location.hostname : "your domain"}" to the list.`;
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Google.";
    case "auth/popup-blocked":
      return "The sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
    case "auth/cancelled-popup-request":
    case "auth/popup-closed-by-user":
      return "";
    default:
      return `Google sign-in failed${err?.code ? ` (${err.code})` : ""}. Please try again.`;
  }
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/Logo";
import { Eye, EyeOff, Chrome } from "lucide-react";

// ---------------------------------------------------------------------------
// Left brand panel — hidden on < lg
// ---------------------------------------------------------------------------

function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-950 px-12 py-12 lg:flex">
      {/* Radial glow */}
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
          &ldquo;Compliant, explainable credit decisions in milliseconds.&rdquo;
        </blockquote>
        <p className="font-mono text-sm text-zinc-500">
          FCRA · SR 11-7 · SHAP explainability · ISO 8601 audit logs
        </p>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-xs text-zinc-600">
          Trusted by lending teams at scale
        </p>
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
// Page
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectToCrp = async (fallbackPath = "/dashboard") => {
    const nextPath = sanitizeNextPath(searchParams.get("next") ?? fallbackPath);
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push(fallbackPath);
      return;
    }

    const redirected = await redirectUserToCrp(currentUser, nextPath);
    if (!redirected) {
      setError("No tenant could be resolved for your account. Contact your administrator.");
      router.push("/dashboard");
    }
  };

  // Handle popup-blocked → redirect fallback: Firebase redirects back to /login
  // with the auth result in the URL. getRedirectResult() resolves it on mount.
  useEffect(() => {
    if (!auth || !(auth as any).onAuthStateChanged) return; // stub guard
    setGoogleLoading(true);
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          redirectToCrp();
        } else {
          setGoogleLoading(false);
        }
      })
      .catch((err: any) => {
        setGoogleLoading(false);
        const msg = resolveGoogleError(err);
        if (msg) setError(msg);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Email login
  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const redirected = await redirectUserToCrp(credential.user, sanitizeNextPath(searchParams.get("next")));
      if (!redirected) {
        setError("No tenant could be resolved for your account. Contact your administrator.");
        router.push("/dashboard");
      }
    } catch (err: any) {
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to log in. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth — popup flow (works without Firebase Hosting /__/firebase/ routes)
  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const redirected = await redirectUserToCrp(credential.user, sanitizeNextPath(searchParams.get("next")));
      if (!redirected) {
        setError("No tenant could be resolved for your account. Contact your administrator.");
        router.push("/dashboard");
      }
    } catch (err: any) {
      setGoogleLoading(false);
      const msg = resolveGoogleError(err);
      if (msg) setError(msg);
    }
  };

  return (
    <div className="grid min-h-screen bg-surface-base lg:grid-cols-2">
      <BrandPanel />

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Logo href="/" size={28} showWordmark />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-100">Welcome back</h1>
            <p className="text-sm text-zinc-500">
              Sign in to your AgentHive account.
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
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-border" />
            <span className="font-mono text-[10px] text-zinc-600">or</span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>

          {/* Email form */}
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-zinc-500 hover:text-brand-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {isLoading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-brand-400 hover:text-brand-300 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}



