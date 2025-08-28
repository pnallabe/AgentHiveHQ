import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { AnimatedSection } from "./animated-section";

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden bg-background py-20 md:py-28 lg:py-32">
      <div className="container relative z-10 mx-auto max-w-5xl px-4 text-center">
        <AnimatedSection delay="delay-100">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Welcome to <span className="text-primary">AgentHiveHQ</span>
          </h1>
        </AnimatedSection>

        <AnimatedSection delay="delay-300">
          <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground sm:text-xl md:text-2xl">
            Powering the Future with Autonomous AI Agents
          </p>
        </AnimatedSection>
        
        <AnimatedSection delay="delay-500">
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/rulesense">
                Explore RuleSense
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/#contact">Contact Us</Link>
            </Button>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
