import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function RuleSensePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto max-w-4xl px-4 py-16 text-center">
        <Image 
          src="https://placehold.co/300x200.png" 
          alt="RuleSense Logo or Feature Graphic" 
          width={300} 
          height={200}
          className="mx-auto mb-8 rounded-lg shadow-md"
          data-ai-hint="compliance AI abstract"
        />
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
          RuleSense
        </h1>
        <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
          The intelligent solution for navigating complex regulatory and compliance landscapes.
        </p>
        <p className="mt-4 text-base text-muted-foreground">
          This page is a placeholder for the RuleSense product. More details coming soon!
        </p>
        <div className="mt-10">
          <Button size="lg" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
