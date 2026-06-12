import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl mb-8">
          Terms of Service
        </h1>
        <div className="space-y-6 text-muted-foreground">
          <p>Last Updated: January 1, 2025</p>

          <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>By accessing or using the Helix Decisions, Inc. website and services (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, do not use the Service.</p>

          <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
          <p>Helix Decisions, Inc. provides information about its AI agent-based products and related services. The Service may include access to content, features, and functionality offered by Helix Decisions, Inc..</p>

          <h2 className="text-xl font-semibold text-foreground">3. User Conduct</h2>
          <p>You agree not to use the Service for any unlawful purpose or in any way that might harm, damage, or disparage any other party. You also agree not to:</p>
          <ul className="list-disc list-inside ml-4">
            <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
            <li>Use any data mining, robots, or similar data gathering or extraction methods.</li>
            <li>Attempt to gain unauthorized access to any portion of the Service or any other accounts, computer systems, or networks connected to the Service.</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">4. Intellectual Property</h2>
          <p>All content, features, and functionality on the Service, including text, graphics, logos, icons, and images, are the exclusive property of Helix Decisions, Inc. or its licensors and are protected by international copyright, trademark, and other intellectual property laws.</p>

          <h2 className="text-xl font-semibold text-foreground">5. Disclaimer of Warranties</h2>
          <p>The Service is provided on an "as is" and "as available" basis. Helix Decisions, Inc. makes no warranties, expressed or implied, regarding the Service, including but not limited to its reliability, accuracy, or availability.</p>

          <h2 className="text-xl font-semibold text-foreground">6. Limitation of Liability</h2>
          <p>In no event shall Helix Decisions, Inc. be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service.</p>

          <h2 className="text-xl font-semibold text-foreground">7. Changes to Terms</h2>
          <p>Helix Decisions, Inc. reserves the right to modify these Terms at any time. We will post the revised Terms on the Service and update the "Last Updated" date. Your continued use of the Service after the posting of the revised Terms constitutes your acceptance of the changes.</p>

          <h2 className="text-xl font-semibold text-foreground">8. Governing Law</h2>
          <p>These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law principles.</p>
          
          <h2 className="text-xl font-semibold text-foreground">9. Contact Information</h2>
          <p>If you have any questions about these Terms, please contact us at hello@helixdecisions.ai.</p>
        </div>
        <div className="mt-12 text-center">
          <Button asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
