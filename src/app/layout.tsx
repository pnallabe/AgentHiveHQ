import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { GeistMono } from 'geist/font/mono';
import { Inter, Space_Grotesk } from 'next/font/google';
import { cn } from '@/lib/utils';
import { PageTransitionWrapper } from '@/components/layout/page-transition-wrapper';

// ── Fonts loaded via next/font for zero-FOUT, self-hosted, optimised subsetting
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://helixdecisions.ai'),
  title: 'Helix Decisions – AI Credit Decisioning Platform',
  description: 'Production-ready AI underwriting, explainability, and governance for lenders who cannot afford guesswork.',
  keywords: "AI credit decisioning, underwriting, SHAP explainability, model governance, FCRA compliance, Helix Decisions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(GeistMono.variable, inter.variable, spaceGrotesk.variable)}
    >
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <PageTransitionWrapper>
              {children}
            </PageTransitionWrapper>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
