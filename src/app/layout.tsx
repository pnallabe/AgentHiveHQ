
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context'; // Added AuthProvider

export const metadata: Metadata = {
  metadataBase: new URL('https://agenthivehq.com'), // Added metadataBase
  title: 'AgentHiveHQ - Autonomous AI Agents',
  description: 'Powering the Future with Autonomous AI Agents. AgentHiveHQ builds the next generation of AI agent-based products.',
  keywords: "AI agents, autonomous agents, RuleSense, compliance AI, legal tech, AI products, AgentHiveHQ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning={true}> {/* Added suppressHydrationWarning here */}
        <AuthProvider> {/* Wrapped children with AuthProvider */}
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
