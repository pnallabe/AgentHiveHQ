/**
 * Analytics SWR hooks — one hook per endpoint with shared configuration.
 *
 * All hooks use:
 *   refreshInterval: 900_000   (15 minutes — matches backend TTL for live data)
 *   keepPreviousData: true      (no loading flash on period/product change)
 *   revalidateOnFocus: false    (exec dashboard is typically full-screen; no flicker needed)
 *
 * Each hook returns the SWR tuple { data, error, isLoading, mutate }.
 */

"use client";

import useSWR, { type KeyedMutator } from "swr";
import {
  fetchOverview,
  fetchFinancial,
  fetchOperational,
  fetchRisk,
  fetchProjections,
  fetchCorporate,
  postAiNarrative,
  type CorporateResponse,
  type FinancialResponse,
  type OperationalResponse,
  type OverviewResponse,
  type ProductFilter,
  type PeriodToken,
  type ProjectionsResponse,
  type RiskResponse,
  type ScenarioToken,
  type HorizonToken,
  type AiNarrativeRequest,
  type AiNarrativeResponse,
} from "@/lib/analytics-api";

// ─────────────────────────────────────────────────────────────────────────────
// Shared SWR config
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_CONFIG = {
  refreshInterval: 900_000,
  keepPreviousData: true,
  revalidateOnFocus: false,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Hook return type helper
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsHookResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  mutate: KeyedMutator<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────

export function useOverview(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
  dateFrom?: string,
  dateTo?: string,
): AnalyticsHookResult<OverviewResponse> {
  const key = `analytics:overview:${period}:${product}:${dateFrom ?? ""}:${dateTo ?? ""}`;
  const { data, error, isLoading, mutate } = useSWR<OverviewResponse>(
    key,
    () => fetchOverview(period, product, dateFrom, dateTo),
    SHARED_CONFIG,
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial
// ─────────────────────────────────────────────────────────────────────────────

export function useFinancial(
  period: PeriodToken = "ytd",
  product: ProductFilter = "all",
  breakdown: "monthly" | "quarterly" = "monthly",
): AnalyticsHookResult<FinancialResponse> {
  const key = `analytics:financial:${period}:${product}:${breakdown}`;
  const { data, error, isLoading, mutate } = useSWR<FinancialResponse>(
    key,
    () => fetchFinancial(period, product, breakdown),
    SHARED_CONFIG,
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Operational
// ─────────────────────────────────────────────────────────────────────────────

export function useOperational(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
): AnalyticsHookResult<OperationalResponse> {
  const key = `analytics:operational:${period}:${product}`;
  const { data, error, isLoading, mutate } = useSWR<OperationalResponse>(
    key,
    () => fetchOperational(period, product),
    SHARED_CONFIG,
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk
// ─────────────────────────────────────────────────────────────────────────────

export function useRisk(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
): AnalyticsHookResult<RiskResponse> {
  const key = `analytics:risk:${period}:${product}`;
  const { data, error, isLoading, mutate } = useSWR<RiskResponse>(
    key,
    () => fetchRisk(period, product),
    SHARED_CONFIG,
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Projections
// ─────────────────────────────────────────────────────────────────────────────

export function useProjections(
  horizon: HorizonToken = "12m",
  product: ProductFilter = "all",
  scenario: ScenarioToken = "base",
): AnalyticsHookResult<ProjectionsResponse> {
  const key = `analytics:projections:${horizon}:${product}:${scenario}`;
  const { data, error, isLoading, mutate } = useSWR<ProjectionsResponse>(
    key,
    () => fetchProjections(horizon, product, scenario),
    {
      ...SHARED_CONFIG,
      refreshInterval: 3_600_000, // projections: 60-minute cache matches backend TTL
    },
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Corporate
// ─────────────────────────────────────────────────────────────────────────────

export function useCorporate(
  period: PeriodToken = "ytd",
): AnalyticsHookResult<CorporateResponse> {
  const key = `analytics:corporate:${period}`;
  const { data, error, isLoading, mutate } = useSWR<CorporateResponse>(
    key,
    () => fetchCorporate(period),
    {
      ...SHARED_CONFIG,
      refreshInterval: 3_600_000,
    },
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Narrative  (POST — keyed by period + sections)
// ─────────────────────────────────────────────────────────────────────────────

export function useAiNarrative(
  request: AiNarrativeRequest,
  enabled = true,
): AnalyticsHookResult<AiNarrativeResponse> {
  const sections = (request.include_sections ?? ["financial", "operational", "risk"]).sort().join(",");
  const key = enabled
    ? `analytics:ai-narrative:${request.period}:${sections}:${request.tone ?? "board_brief"}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<AiNarrativeResponse>(
    key,
    () => postAiNarrative(request),
    {
      ...SHARED_CONFIG,
      refreshInterval: 1_800_000, // AI narrative: 30-minute cache
    },
  );
  return { data, error, isLoading, mutate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations for ExportButton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns mutate functions for all six data hooks so ExportButton
 * can trigger a fresh revalidation before generating the PDF.
 */
export function useAnalyticsMutations(
  period: PeriodToken,
  product: ProductFilter,
) {
  const { mutate: mutateOverview } = useOverview(period, product);
  const { mutate: mutateFinancial } = useFinancial(period, product);
  const { mutate: mutateOperational } = useOperational(period, product);
  const { mutate: mutateRisk } = useRisk(period, product);
  const { mutate: mutateProjections } = useProjections();
  const { mutate: mutateCorporate } = useCorporate(period);

  return async () => {
    await Promise.all([
      mutateOverview(),
      mutateFinancial(),
      mutateOperational(),
      mutateRisk(),
      mutateProjections(),
      mutateCorporate(),
    ]);
  };
}
