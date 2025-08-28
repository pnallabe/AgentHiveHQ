import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { AnimatedSection } from "./animated-section";

const products = [
  {
    name: "RuleSense",
    description: "RuleSense is an intelligent web application that translates complex regulatory and compliance scenarios into tailored checklists, citations, and guidance—powered entirely by AI agents.",
    link: "/rulesense",
    comingSoon: false,
  },
  {
    name: "AutoBrief",
    description: "AI agent that creates executive-ready summaries from lengthy documents.",
    link: "#",
    comingSoon: true,
  },
  {
    name: "DealScout",
    description: "An autonomous agent that finds and evaluates business deals and partnerships.",
    link: "#",
    comingSoon: true,
  },
];

export function ProductsSection() {
  return (
    <section id="products" className="bg-secondary">
      <div className="container mx-auto max-w-7xl px-4">
        <AnimatedSection className="text-center mb-12 md:mb-16">
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Our Products
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Discover innovative solutions designed to enhance your capabilities.
          </p>
        </AnimatedSection>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <AnimatedSection key={product.name} delay={`delay-${index * 150}`}>
              <Card className="flex h-full flex-col overflow-hidden rounded-xl shadow-lg transition-all hover:shadow-2xl hover:scale-[1.02]">
                <CardHeader>
                   <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl font-semibold">{product.name}</CardTitle>
                    {product.comingSoon && (
                      <Badge variant="outline" className="border-accent text-accent">Coming Soon</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-grow flex-col">
                  <CardDescription className="mt-3 flex-grow text-base text-muted-foreground">
                    {product.description}
                  </CardDescription>
                </CardContent>
                <CardFooter className="p-6 pt-0">
                  <Button 
                    asChild 
                    variant={product.comingSoon ? "outline" : "default"} 
                    className={`w-full ${product.comingSoon ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={product.comingSoon}
                    aria-disabled={product.comingSoon}
                  >
                    {product.comingSoon ? (
                      <span>Learn More (Soon)</span>
                    ) : (
                      <Link href={product.link}>
                        Learn More <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
