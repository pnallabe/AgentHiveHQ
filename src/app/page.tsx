import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/landing/hero-section";
import { AboutSection } from "@/components/landing/about-section";
import { ProductsSection } from "@/components/landing/products-section";
import { RuleSenseHighlightSection } from "@/components/landing/rulesense-highlight-section";
import { TechStackSection } from "@/components/landing/tech-stack-section";
import { ContactSection } from "@/components/landing/contact-section";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        <AboutSection />
        <ProductsSection />
        <RuleSenseHighlightSection />
        <TechStackSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
