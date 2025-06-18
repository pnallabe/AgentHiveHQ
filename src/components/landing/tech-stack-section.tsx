import { BrainCircuitIcon, Code2Icon, DatabaseIcon, LayersIcon, LinkIcon, TriangleIcon } from "lucide-react";
import { AnimatedSection } from "./animated-section";
import { Card, CardContent } from "@/components/ui/card";

const techStack = [
  { name: "Python", icon: Code2Icon, description: "Versatile backend language." },
  { name: "LangChain", icon: LinkIcon, description: "Framework for LLM applications." },
  { name: "PostgreSQL", icon: DatabaseIcon, description: "Robust relational database." },
  { name: "ChromaDB", icon: LayersIcon, description: "AI-native vector database." },
  { name: "Next.js", icon: TriangleIcon, description: "React framework for web." },
  { name: "OpenAI", icon: BrainCircuitIcon, description: "Advanced AI models." },
];

export function TechStackSection() {
  return (
    <section id="tech-stack" className="bg-secondary">
      <div className="container mx-auto max-w-7xl px-4">
        <AnimatedSection className="text-center">
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Built with Cutting-Edge Technology
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            We leverage LLMs, autonomous agents, vector databases, and real-time retrieval pipelines to power our products.
          </p>
        </AnimatedSection>

        <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {techStack.map((tech, index) => (
            <AnimatedSection key={tech.name} delay={`delay-${index * 100}`}>
              <Card className="h-full transform rounded-xl bg-background p-1 shadow-lg transition-all hover:scale-105 hover:shadow-primary/20">
                <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <tech.icon className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
                  <h3 className="text-md font-semibold text-foreground">{tech.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{tech.description}</p>
                </CardContent>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
