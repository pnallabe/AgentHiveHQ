
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { GeistMono } from 'geist/font/mono';

export const metadata: Metadata = {
  metadataBase: new URL('https://agenthivehq.com'),
  title: 'AgentHive – AI Credit Decisioning Platform',
  description: 'Production-ready AI underwriting, explainability, and governance for lenders who cannot afford guesswork.',
  keywords: "AI credit decisioning, underwriting, SHAP explainability, model governance, FCRA compliance, AgentHive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistMono.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <AuthProvider>
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
