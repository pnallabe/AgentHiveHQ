/**
 * KpiCardGrid — responsive grid of KpiCard components.
 *
 * Layout: 4-col desktop / 2-col tablet / 1-col mobile
 *   grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
 */
"use client";

import { cn } from "@/lib/utils";
import { KpiCard, type KpiCardProps } from "./KpiCard";

export interface KpiCardGridProps {
  cards: KpiCardProps[];
  cols?: 3 | 4 | 6;
  className?: string;
}

const colClasses: Record<number, string> = {
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-1 sm:grid-cols-3 lg:grid-cols-6",
};

export function KpiCardGrid({ cards, cols = 4, className }: KpiCardGridProps) {
  return (
    <div className={cn("grid gap-4", colClasses[cols] ?? colClasses[4], className)}>
      {cards.map((card, i) => (
        <KpiCard key={`${card.label}-${i}`} {...card} />
      ))}
    </div>
  );
}
