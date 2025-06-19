
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const mockRegulatoryUpdates = [
  {
    id: "1",
    title: "New Data Privacy Law (NDPL) Enacted",
    summary: "The NDPL introduces stricter consent requirements for data processing and enhances individual rights regarding personal data. Businesses must update their privacy policies and data handling practices by Q4 2025.",
    date: "June 15, 2025",
    source: "Official Gazette Vol. 102",
    link: "#",
  },
  {
    id: "2",
    title: "Updated Anti-Money Laundering (AML) Directives",
    summary: "Financial institutions are now required to implement enhanced due diligence measures for high-risk clients and report suspicious transactions more promptly. New guidelines on cryptocurrency transactions are also included.",
    date: "June 10, 2025",
    source: "Financial Regulatory Authority",
    link: "#",
  },
  {
    id: "3",
    title: "Environmental Compliance Standards Revised for Manufacturing",
    summary: "Manufacturing companies must adhere to new emission limits and waste disposal protocols. The revisions aim to reduce industrial pollution by 20% over the next five years. Reporting deadlines are quarterly.",
    date: "May 28, 2025",
    source: "Environmental Protection Agency",
    link: "#",
  },
];

export function RegulatoryIntelligenceWidget() {
  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center">
            <Newspaper className="mr-3 h-6 w-6 text-primary" />
            Regulatory Intelligence
          </CardTitle>
          {/* <Button variant="ghost" size="sm">View All</Button> */}
        </div>
        <CardDescription>Top 3 recent updates in rules and regulations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {mockRegulatoryUpdates.map((update) => (
          <div key={update.id} className="border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
            <h4 className="font-semibold text-md text-foreground mb-1">{update.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{update.summary}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground/80">
              <span>{update.source} - {update.date}</span>
              <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                <Link href={update.link} target="_blank" rel="noopener noreferrer">
                  Read More <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
         <div className="pt-2 text-center">
            <Button variant="outline" size="sm" disabled>
                View All Updates (Coming Soon)
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
