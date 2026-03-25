"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Command } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScenarioSelector, type Scenario } from "@/components/lab/ScenarioSelector";
import { cn } from "@/lib/utils";
import type { UnderwritingRequest } from "@/lib/types";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const inputSchema = z.object({
  income: z
    .number({ invalid_type_error: "Income is required" })
    .min(1_000, "Income must be at least $1,000")
    .max(999_999, "Income must be below $1,000,000"),
  employment_length: z
    .number()
    .min(0, "Cannot be negative")
    .max(30, "Maximum 30 years"),
  housing_status: z.enum(["own", "mortgage", "rent"], {
    errorMap: () => ({ message: "Select a housing status" }),
  }),
  credit_score: z.number().min(300).max(850).nullable(),
  thin_file: z.boolean(),
});

export type InputFormValues = z.infer<typeof inputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InputPanelProps {
  onSubmit: (payload: UnderwritingRequest) => Promise<void>;
  isLoading: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Income band classification
// ---------------------------------------------------------------------------

function incomeBand(income: number | undefined): {
  label: string;
  className: string;
} {
  if (!income || income < 25_000) return { label: "< $25k",     className: "bg-reject-muted text-reject-base border-reject-base/30" };
  if (income < 50_000)           return { label: "$25–50k",    className: "bg-review-muted text-amber-400 border-amber-700/30" };
  if (income < 100_000)          return { label: "$50–100k",   className: "bg-brand-950 text-brand-400 border-brand-700/30" };
  return                                { label: "> $100k",    className: "bg-approve-muted text-approve-base border-approve-base/30" };
}

// ---------------------------------------------------------------------------
// Credit score quality bar
// ---------------------------------------------------------------------------

function scoreBar(score: number | null): { pct: number; color: string } {
  if (!score) return { pct: 0, color: "bg-zinc-700" };
  const pct = ((score - 300) / 550) * 100;
  if (score >= 740) return { pct, color: "bg-approve-base" };
  if (score >= 670) return { pct, color: "bg-brand-500" };
  if (score >= 580) return { pct, color: "bg-amber-400" };
  return { pct, color: "bg-reject-base" };
}

export function InputPanel({ onSubmit, isLoading, className }: InputPanelProps) {
  const {
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InputFormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      income: 55000,
      employment_length: 3,
      housing_status: "rent",
      credit_score: 680,
      thin_file: false,
    },
  });

  const thinFile = watch("thin_file");
  const employmentLength = watch("employment_length");
  const incomeVal = watch("income");
  const creditScoreVal = watch("credit_score");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | undefined>(undefined);

  const band = incomeBand(incomeVal);
  const bar  = scoreBar(thinFile ? null : creditScoreVal);

  // ⌘+Enter / Ctrl+Enter keyboard shortcut
  const formRef = useRef<HTMLFieldSetElement>(null);
  const doSubmit = useCallback(() => {
    handleSubmit(onFormSubmit)();
  }, [handleSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isLoading) {
        doSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doSubmit, isLoading]);

  // When thin-file checked, clear credit score
  useEffect(() => {
    if (thinFile) {
      setValue("credit_score", null);
    }
  }, [thinFile, setValue]);

  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenarioId(scenario.id);
    setValue("income", scenario.preset.income);
    setValue("employment_length", scenario.preset.employment_length);
    setValue("housing_status", scenario.preset.housing_status);
    if (scenario.preset.credit_score === null) {
      setValue("thin_file", true);
      setValue("credit_score", null);
    } else {
      setValue("thin_file", false);
      setValue("credit_score", scenario.preset.credit_score);
    }
  };

  const onFormSubmit = async (values: InputFormValues) => {
    const payload: UnderwritingRequest = {
      income: values.income,
      employment_length: values.employment_length,
      housing_status: values.housing_status,
      credit_score: values.thin_file ? null : values.credit_score,
      demo_mode: false, // overridden by parent if demo mode active
    };
    await onSubmit(payload);
  };

  return (
    <fieldset
      ref={formRef}
      disabled={isLoading}
      className={cn(
        "space-y-5 rounded-xl border border-surface-border bg-surface-raised p-4 disabled:pointer-events-none disabled:opacity-60",
        className
      )}
      aria-label="Applicant profile form"
    >
      {/* Scenario presets */}
      <ScenarioSelector selectedId={selectedScenarioId} onSelect={handleScenarioSelect} />

      <div className="border-t border-surface-border pt-5 space-y-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Applicant Details
        </p>

        {/* Income */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="income" className="text-zinc-300">Annual Income</Label>
            {/* Income band pill — 150ms cross-fade */}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums transition-all duration-150",
                band.className
              )}
            >
              {band.label}
            </span>
          </div>
          <Controller
            name="income"
            control={control}
            render={({ field }) => (
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500 text-sm">$</span>
                <Input
                  id="income"
                  type="text"
                  inputMode="numeric"
                  className="pl-7 bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                  placeholder="75,000"
                  value={field.value ? formatCurrency(String(field.value)) : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    field.onChange(raw ? Number(raw) : undefined);
                  }}
                />
              </div>
            )}
          />
          {errors.income && <p className="text-xs text-reject-base">{errors.income.message}</p>}
        </div>

        {/* Employment length */}
        <div className="space-y-1.5">
          <Label className="text-zinc-300">
            Employment Length
            <span className="ml-2 font-mono text-brand-400">
              {employmentLength === 1 ? "1 yr" : `${Number(employmentLength).toFixed(1)} yrs`}
            </span>
          </Label>
          <Controller
            name="employment_length"
            control={control}
            render={({ field }) => (
              <Slider
                min={0} max={30} step={0.5}
                value={[field.value]}
                onValueChange={([v]) => field.onChange(v)}
                className="w-full"
                aria-label="Employment length in years"
              />
            )}
          />
          {errors.employment_length && <p className="text-xs text-reject-base">{errors.employment_length.message}</p>}
        </div>

        {/* Housing status */}
        <div className="space-y-1.5">
          <Label htmlFor="housing_status" className="text-zinc-300">Housing Status</Label>
          <Controller
            name="housing_status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="housing_status"
                  className="bg-surface-overlay border-surface-border text-zinc-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-surface-overlay border-surface-border">
                  <SelectItem value="own">Own</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.housing_status && <p className="text-xs text-reject-base">{errors.housing_status.message}</p>}
        </div>

        {/* Credit score */}
        <div className="space-y-2">
          <Label htmlFor="credit_score" className="text-zinc-300">Credit Score</Label>
          <Controller
            name="credit_score"
            control={control}
            render={({ field }) => (
              <Input
                id="credit_score"
                type="number"
                min={300} max={850}
                disabled={thinFile}
                placeholder="300–850"
                className="bg-surface-overlay border-surface-border text-zinc-100 placeholder:text-zinc-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 disabled:opacity-40"
                value={field.value ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  field.onChange(v === "" ? null : Number(v));
                }}
              />
            )}
          />

          {/* Quality bar — 4px, 300ms transition */}
          {!thinFile && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-border">
              <div
                className={cn("h-full rounded-full transition-all duration-300", bar.color)}
                style={{ width: `${bar.pct}%` }}
                aria-hidden
              />
            </div>
          )}

          {errors.credit_score && !thinFile && (
            <p className="text-xs text-reject-base">{errors.credit_score.message}</p>
          )}

          {/* Thin-file checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <Controller
              name="thin_file"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="thin_file"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-zinc-600 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
                />
              )}
            />
            <Label htmlFor="thin_file" className="cursor-pointer select-none text-sm text-zinc-400">
              No credit history (thin file)
            </Label>
          </div>
        </div>

        {/* Submit — with ⌘+Enter shortcut hint */}
        <Button
          type="button"
          onClick={handleSubmit(onFormSubmit)}
          disabled={isLoading}
          className="w-full bg-brand-500 font-semibold text-white hover:bg-brand-600 focus-visible:ring-brand-500"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Analysing…
            </>
          ) : (
            <span className="flex items-center gap-2">
              Run Decision
              <span className="flex items-center gap-0.5 font-mono text-[10px] opacity-60">
                <Command className="h-2.5 w-2.5" />+↵
              </span>
            </span>
          )}
        </Button>
      </div>
    </fieldset>
  );
}
