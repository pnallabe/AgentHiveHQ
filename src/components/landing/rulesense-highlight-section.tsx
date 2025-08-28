import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { AnimatedSection } from "./animated-section";

const features = [
  "Natural language inputs",
  "AI-powered compliance checklist",
  "Cited legal/regulatory sources",
  "Interactive Q&A agent",
];

export function RuleSenseHighlightSection() {
  return (
    <section id="rulesense-highlight" className="overflow-hidden bg-background">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-24">
          <AnimatedSection initialClassName="opacity-0 lg:-translate-x-10" animationClassName="!opacity-100 !lg:translate-x-0" className="lg:col-span-2 text-center">
            <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Meet <span className="text-primary">RuleSense</span>
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl mx-auto">
              Say goodbye to compliance confusion. RuleSense uses advanced language models and retrieval-augmented generation (RAG) to provide clarity, citations, and compliance pathways—instantly.
            </p>
            <div className="flex justify-center">
              <ul className="mt-8 space-y-3 text-left inline-block">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle2 className="mr-3 mt-1 h-6 w-6 flex-shrink-0 text-accent" />
                    <span className="text-base text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-10">
              <Button size="lg" asChild>
                <Link href="/rulesense">Try RuleSense Now</Link>
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
