"use client";

import {
  ShieldCheck,
  TrendingUp,
  User,
  Zap,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HousingStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Scenario definitions (matches CODING_PROMPT.md §5.3)
// ---------------------------------------------------------------------------

export interface ScenarioPreset {
  income: number;
  employment_length: number;
  housing_status: HousingStatus;
  credit_score: number | null;
}

export interface Scenario {
  id: string;
  label: string;
  description: string;
  Icon: React.ElementType;
  iconColor: string;
  preset: ScenarioPreset;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "prime_applicant",
    label: "Prime Applicant",
    description: "Established professional with strong credit",
    Icon: ShieldCheck,
    iconColor: "text-emerald-400",
    preset: {
      income: 120000,
      employment_length: 8,
      housing_status: "mortgage",
      credit_score: 760,
    },
  },
  {
    id: "near_prime",
    label: "Near-Prime Borrower",
    description: "Steady income, limited credit history",
    Icon: TrendingUp,
    iconColor: "text-blue-400",
    preset: {
      income: 55000,
      employment_length: 2,
      housing_status: "rent",
      credit_score: 640,
    },
  },
  {
    id: "thin_file",
    label: "Thin-File Applicant",
    description: "No credit history — income-based assessment",
    Icon: User,
    iconColor: "text-zinc-400",
    preset: {
      income: 68000,
      employment_length: 3,
      housing_status: "rent",
      credit_score: null,
    },
  },
  {
    id: "gig_worker",
    label: "Gig Economy Worker",
    description: "Irregular income, no formal employment",
    Icon: Zap,
    iconColor: "text-amber-400",
    preset: {
      income: 42000,
      employment_length: 1,
      housing_status: "rent",
      credit_score: null,
    },
  },
  {
    id: "new_immigrant",
    label: "New-to-Country Applicant",
    description: "High income, zero US credit history",
    Icon: Globe,
    iconColor: "text-sky-400",
    preset: {
      income: 95000,
      employment_length: 0.5,
      housing_status: "rent",
      credit_score: null,
    },
  },
  {
    id: "high_risk",
    label: "High-Risk Profile",
    description: "Low income with troubled credit",
    Icon: AlertTriangle,
    iconColor: "text-red-400",
    preset: {
      income: 22000,
      employment_length: 0,
      housing_status: "rent",
      credit_score: 510,
    },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ScenarioSelectorProps {
  selectedId?: string;
  onSelect: (scenario: Scenario) => void;
  className?: string;
}

export function ScenarioSelector({
  selectedId,
  onSelect,
  className,
}: ScenarioSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        Preset Scenarios
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SCENARIOS.map((scenario) => {
          const { Icon } = scenario;
          const isSelected = selectedId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onSelect(scenario)}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                isSelected
                  ? "scale-[1.01] border-brand-500 bg-brand-950 shadow-brand-500/10"
                  : "border-surface-border bg-surface-raised hover:border-zinc-600 hover:bg-surface-overlay"
              )}
            >
              <Icon
                className={cn("h-4 w-4 shrink-0", scenario.iconColor)}
                aria-hidden
              />
              <span className={cn(
                "text-xs font-semibold leading-tight transition-colors",
                isSelected ? "text-brand-300" : "text-zinc-200"
              )}>
                {scenario.label}
              </span>
              <span className="line-clamp-2 text-[10px] leading-snug text-zinc-500">
                {scenario.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
