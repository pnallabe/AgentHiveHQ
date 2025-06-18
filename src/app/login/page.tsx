
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RocketIcon } from "lucide-react";
// import { Separator } from "@/components/ui/separator";
// import { Github, ChromeIcon } from "lucide-react"; // For OAuth buttons later

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to log in. Please try again later.");
      }
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Placeholder for OAuth, to be implemented later
  // const handleOAuthLogin = async (providerName: string) => {
  //   // Implementation for Google/Microsoft login
  //   console.log(`Login with ${providerName}`);
  //   setError("OAuth login is not yet implemented.");
  // };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link href="/#home" className="mb-8 flex items-center gap-2">
        <RocketIcon className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold text-foreground">AgentHiveHQ</span>
      </Link>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
          <CardDescription>Log in to access your RuleSense dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base"
              />
            </div>
            <div className="flex items-center justify-end">
              <Button variant="link" asChild className="p-0 h-auto text-sm">
                <Link href="/forgot-password">Forgot password?</Link>
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Logging In..." : "Log In"}
            </Button>
          </form>
          {/* OAuth buttons placeholder - to be implemented later
          <Separator className="my-6" />
          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={() => handleOAuthLogin('Google')} disabled={isLoading}>
              <ChromeIcon className="mr-2 h-5 w-5" /> Log in with Google
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleOAuthLogin('Microsoft')} disabled={isLoading}>
              <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5714 2H2V11.5714H11.5714V2ZM22 2H12.4286V11.5714H22V2ZM11.5714 12.4286H2V22H11.5714V12.4286ZM22 12.4286H12.4286V22H22V12.4286Z"></path></svg>
              Log in with Microsoft
            </Button>
          </div>
          */}
        </CardContent>
        <CardFooter className="flex-col items-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
