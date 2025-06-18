import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow container mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-headline text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-5xl mb-8">
          Privacy Policy
        </h1>
        <div className="space-y-6 text-muted-foreground">
          <p>Effective Date: January 1, 2025</p>
          
          <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
          <p>Welcome to AgentHiveHQ. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website [Your Website URL] and use our services.</p>

          <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
          <p>We may collect personal information such as your name, email address, and any other information you voluntarily provide to us when you fill out a contact form, subscribe to a newsletter, or otherwise interact with our Site.</p>
          <p>We may also collect non-personal information, such as browser type, operating system, and website usage data through cookies and other tracking technologies.</p>

          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside ml-4">
            <li>Provide, operate, and maintain our website and services.</li>
            <li>Improve, personalize, and expand our website and services.</li>
            <li>Understand and analyze how you use our website and services.</li>
            <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes.</li>
            <li>Process your transactions.</li>
            <li>Find and prevent fraud.</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">4. Sharing Your Information</h2>
          <p>We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice. This does not include website hosting partners and other parties who assist us in operating our website, conducting our business, or serving our users, so long as those parties agree to keep this information confidential.</p>
          
          <h2 className="text-xl font-semibold text-foreground">5. Data Security</h2>
          <p>We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.</p>

          <h2 className="text-xl font-semibold text-foreground">6. Your Data Protection Rights</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, such as the right to access, correct, or delete your data.</p>

          <h2 className="text-xl font-semibold text-foreground">7. Changes to This Privacy Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>

          <h2 className="text-xl font-semibold text-foreground">8. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at hello@agenthivehq.com.</p>
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
