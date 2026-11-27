import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { TenantProvider } from '@/contexts/TenantContext';
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
  metadataBase: new URL('https://agenthivehq.com'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'AgentHive | Audit-Ready AI Credit Decisioning',
    template: '%s | AgentHive',
  },
  description:
    'Governance-native credit decisioning for regulated lenders. Approve thin-file borrowers with models you own — and pass SR 11-7 exams with machine-generated audit packages.',
  keywords:
    'AI credit decisioning, model risk management, SR 11-7, audit package, model governance, thin-file underwriting, explainability, FCRA compliance, adverse action reasons, AgentHive',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agenthivehq.com',
    siteName: 'AgentHive',
    title: 'AgentHive | Audit-Ready AI Credit Decisioning',
    description:
      'Governance-native credit decisioning for regulated lenders. Approve thin-file borrowers with models you own — and pass SR 11-7 exams with machine-generated audit packages.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
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
            <TenantProvider>
              <PageTransitionWrapper>
                {children}
              </PageTransitionWrapper>
            </TenantProvider>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
