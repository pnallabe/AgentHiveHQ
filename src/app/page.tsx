import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { ProductsSection } from "@/components/landing/products-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { TerminalPreviewSection } from "@/components/landing/terminal-preview-section";
import { CaseStudyTeasersSection } from "@/components/landing/case-study-teasers-section";
import { ComplianceStrip } from "@/components/landing/compliance-strip";
import { ContactSection } from "@/components/landing/contact-section";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        <ProductsSection />
        <HowItWorksSection />
        <TerminalPreviewSection />
        <CaseStudyTeasersSection />
        <ComplianceStrip />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

