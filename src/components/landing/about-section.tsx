import { AnimatedSection } from "./animated-section";

export function AboutSection() {
  return (
    <section id="about" className="bg-background">
      <div className="container mx-auto max-w-5xl px-4">
        <AnimatedSection className="text-center">
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Who We Are
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
            Helix Decisions is a frontier AI company building compliant, explainable credit intelligence for modern lenders.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
