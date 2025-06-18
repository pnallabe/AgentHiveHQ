
"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { withAuth } from "@/components/layout/with-auth";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, ShieldCheck, AlertTriangle, BarChart3 } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

function DashboardPage() {
  const { user } = useAuth();

  // Placeholder data - replace with actual data fetching
  const summaryData = [
    { title: "Outstanding Issues", value: "5", icon: AlertTriangle, color: "text-destructive", progress: 30 },
    { title: "Resolved Issues", value: "25", icon: ShieldCheck, color: "text-green-500", progress: 80 },
    { title: "Documents Managed", value: "120", icon: FileText, color: "text-blue-500", progress: 60 },
    { title: "Compliance Score", value: "85%", icon: BarChart3, color: "text-primary", progress: 85 },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow bg-secondary">
        <div className="container mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <AnimatedSection>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Welcome, {user?.displayName || user?.email || "User"}!
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              This is your RuleSense compliance dashboard.
            </p>
          </AnimatedSection>

          <AnimatedSection delay="delay-150" className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {summaryData.map((item, index) => (
              <Card key={index} className="shadow-lg rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {item.title === "Compliance Score" ? "Overall progress" : `+${Math.floor(Math.random()*5 + 1)} since last week`}
                  </p>
                  <Progress value={item.progress} className="mt-3 h-2" />
                </CardContent>
              </Card>
            ))}
          </AnimatedSection>

          <AnimatedSection delay="delay-300" className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <Card className="lg:col-span-2 shadow-lg rounded-xl">
              <CardHeader>
                <CardTitle>Outstanding Compliance Issues</CardTitle>
                <CardDescription>Track and manage pending compliance tasks.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Placeholder for issues list - to be implemented later */}
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                  <p className="text-muted-foreground">Compliance issues will be displayed here.</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="shadow-lg rounded-xl">
              <CardHeader>
                <CardTitle>RuleSense AI Chat</CardTitle>
                <CardDescription>Ask compliance questions.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Placeholder for chatbot UI - to be implemented later */}
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                  <p className="text-muted-foreground">Chatbot interface coming soon.</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

           <AnimatedSection delay="delay-450" className="mt-10">
            <Card className="shadow-lg rounded-xl">
              <CardHeader>
                <CardTitle>Document Management</CardTitle>
                <CardDescription>Upload and organize your compliance documents.</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Placeholder for document management UI - to be implemented later */}
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
                  <p className="text-muted-foreground">Document features are under development.</p>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default withAuth(DashboardPage);
