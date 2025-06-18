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
            AgentHiveHQ is a frontier tech company building the next generation of autonomous agent-based products. 
            Our mission is to make AI agents that augment human capability across domains—from compliance to research to automation.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
