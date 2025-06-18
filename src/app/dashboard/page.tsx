
"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { withAuth } from "@/components/layout/with-auth";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { FileText, ShieldCheck, AlertTriangle, BarChart3, MessageSquare, FolderArchive, PlusCircle } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";
import Link from "next/link";

function DashboardPage() {
  const { user } = useAuth();

  // Placeholder data - replace with actual data fetching
  const summaryData = [
    { title: "Outstanding Issues", value: "5", icon: AlertTriangle, color: "text-destructive", progress: 30, trend: `+${Math.floor(Math.random()*2 + 1)} this week` },
    { title: "Resolved Issues", value: "25", icon: ShieldCheck, color: "text-green-500", progress: 80, trend: `+${Math.floor(Math.random()*5 + 2)} this week` },
    { title: "Documents Managed", value: "120", icon: FolderArchive, color: "text-blue-500", progress: 60, trend: `+${Math.floor(Math.random()*10 + 5)} files` },
    { title: "Compliance Score", value: "85%", icon: BarChart3, color: "text-primary", progress: 85, trend: "Improving" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <Navbar />
      <main className="flex-grow">
        <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <AnimatedSection>
            <div className="mb-8">
              <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Welcome, {user?.displayName || user?.email || "User"}!
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Your RuleSense compliance overview.
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection delay="delay-100" className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {summaryData.map((item) => (
              <Card key={item.title} className="shadow-lg rounded-xl transition-all hover:shadow-xl hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{item.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.trend}
                  </p>
                  <Progress value={item.progress} className="mt-4 h-2" indicatorClassName={item.color.replace('text-', 'bg-')} />
                </CardContent>
              </Card>
            ))}
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <AnimatedSection delay="delay-200" className="lg:col-span-2 space-y-8">
              <Card className="shadow-lg rounded-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Outstanding Compliance Issues</CardTitle>
                  <CardDescription>Track and manage pending compliance tasks.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-background p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">No Outstanding Issues</h3>
                    <p className="mt-1 text-sm text-muted-foreground">All compliance tasks are currently up to date.</p>
                    <Button variant="outline" size="sm" className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New Task (Coming Soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg rounded-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Document Management</CardTitle>
                  <CardDescription>Upload, organize, and analyze your compliance documents.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-background p-6 text-center">
                    <FolderArchive className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">Document Hub</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Securely manage your compliance documents here.</p>
                     <Button variant="default" size="sm" className="mt-4">
                       <PlusCircle className="mr-2 h-4 w-4" /> Upload Document (Coming Soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
            
            <AnimatedSection delay="delay-300" className="lg:col-span-1">
              <Card className="shadow-lg rounded-xl">
                <CardHeader>
                  <CardTitle className="text-xl">RuleSense AI Assistant</CardTitle>
                  <CardDescription>Ask compliance questions and get AI-powered insights.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[calc(2*(64px+2rem)+8rem+2*2rem)] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/50 bg-background p-6 text-center"> {/* Adjusted height */}
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">Chat with RuleSense</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Get instant answers to your compliance queries.</p>
                    <Button asChild variant="secondary" className="mt-4">
                      <Link href="/rulesense">
                        Open RuleSense Chat
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

export default withAuth(DashboardPage);
