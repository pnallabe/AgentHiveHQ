/**
 * Analytics API Client — typed fetch wrappers for all eight analytics endpoints.
 *
 * All functions return typed response objects mirroring the Python Pydantic schemas.
 * Every function handles data_availability and surfaces it to the caller.
 *
 * Base URL: NEXT_PUBLIC_API_URL environment variable (default: http://localhost:8000)
 * Auth: Firebase ID token injected as Authorization: Bearer
 */

import { auth } from "@/lib/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// Shared leaf types
// ─────────────────────────────────────────────────────────────────────────────

export type DataAvailability = "full" | "partial" | "demo";
export type ProductFilter = "all" | "credit_card" | "mortgage";
export type PeriodToken =
  | "mtd"
  | "qtd"
  | "ytd"
  | "last_30"
  | "last_90"
  | "last_12m"
  | "custom";
export type ScenarioToken = "base" | "stress" | "upside";
export type HorizonToken = "12m" | "24m";

export interface KpiValue {
  value: number | null;
  unit: string;
  delta_pct: number | null;
  vs: string | null;
  alert: boolean | null;
}

export interface DataEnvelope {
  data_availability: DataAvailability;
  missing_sources: string[];
  affected_kpis: string[];
  data_as_of: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview types
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadlineKpis {
  total_revenue: KpiValue;
  net_interest_income: KpiValue;
  total_originations_volume: KpiValue;
  npl_rate: KpiValue;
  approval_rate: KpiValue;
  roe: KpiValue;
}

export interface ProductSplit {
  revenue_share: number | null;
  originations_share: number | null;
}

export interface PlanVsActualSummary {
  revenue_attainment: number | null;
  originations_attainment: number | null;
  npl_within_budget: boolean | null;
  cost_income_ratio: { actual: number; plan: number; status: string } | null;
}

export interface TopRisk {
  code: string;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface OverviewResponse extends DataEnvelope {
  period: PeriodToken;
  product_filter: ProductFilter;
  headline_kpis: HeadlineKpis;
  product_split: Record<string, ProductSplit>;
  plan_vs_actual: PlanVsActualSummary;
  top_risks: TopRisk[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial types
// ─────────────────────────────────────────────────────────────────────────────

export interface IncomeStatement {
  interest_income: number | null;
  fee_income: number | null;
  total_revenue: number | null;
  cost_of_funds: number | null;
  net_interest_income: number | null;
  operating_costs: number | null;
  ecl_charge: number | null;
  profit_before_tax: number | null;
}

export interface Margins {
  net_interest_margin: number | null;
  nim_by_product: Record<string, number | null> | null;
  cost_income_ratio: number | null;
  return_on_equity: number | null;
  return_on_assets: number | null;
}

export interface RevenueTrendPoint {
  period: string;
  interest_income: number | null;
  fee_income: number | null;
  cost_of_funds: number | null;
}

export interface WaterfallItem {
  label: string;
  value: number;
  type: "positive" | "negative" | "subtotal";
}

export interface FinancialResponse extends DataEnvelope {
  period: PeriodToken;
  income_statement: IncomeStatement;
  margins: Margins;
  revenue_trend: RevenueTrendPoint[];
  waterfall: { items: WaterfallItem[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Operational types
// ─────────────────────────────────────────────────────────────────────────────

export interface ByProductOriginations {
  count: number | null;
  volume_gbp: number | null;
  avg_line?: number | null;
  avg_loan?: number | null;
}

export interface Originations {
  total_count: number | null;
  total_volume_gbp: number | null;
  by_product: Record<string, ByProductOriginations> | null;
  by_channel: Record<string, number> | null;
  trend: Array<{ period: string; count: number | null; volume: number | null }>;
}

export interface CreditCardOps {
  average_credit_limit: number | null;
  average_utilisation: number | null;
  activation_rate_30d: number | null;
  average_apr: number | null;
  approval_rate: number | null;
  stp_rate: number | null;
  average_decision_time_seconds: number | null;
}

export interface MortgageOps {
  pipeline_count: number | null;
  pipeline_value_gbp: number | null;
  pipeline_by_stage: Record<string, number> | null;
  average_ltv: number | null;
  stp_rate: number | null;
  average_time_to_offer_days: number | null;
  approval_rate: number | null;
  average_dti: number | null;
}

export interface CustomerService {
  complaint_rate_per_1000: number | null;
  ppi_upheld_rate: number | null;
  complaints_resolved_within_8_weeks_pct: number | null;
  nps_score: number | null;
}

export interface OperationalResponse extends DataEnvelope {
  period: PeriodToken;
  originations: Originations;
  credit_card_ops: CreditCardOps;
  mortgage_ops: MortgageOps;
  customer_service: CustomerService;
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductQuality {
  outstanding: number | null;
  npl_rate: number | null;
  ecl: number | null;
}

export interface PortfolioQuality {
  total_outstanding_gbp: number | null;
  npl_balance_gbp: number | null;
  npl_rate: number | null;
  ecl_provision_gbp: number | null;
  provision_coverage_ratio: number | null;
  net_charge_off_rate_annualised: number | null;
  by_product: Record<string, ProductQuality> | null;
}

export interface DpdDistribution {
  current: number | null;
  dpd_1_29: number | null;
  dpd_30_59: number | null;
  dpd_60_89: number | null;
  dpd_90_plus: number | null;
}

export interface VintageDataPoint {
  months_on_book: number;
  cumulative_default_rate: number;
}

export interface VintageCurve {
  cohort: string;
  product_type: string;
  data_points: VintageDataPoint[];
}

export interface ConcentrationRisk {
  top_10_borrower_pct_of_portfolio: number | null;
  geography: Record<string, number> | null;
  ltv_bands_mortgage: Record<string, number> | null;
}

export interface StressIndicators {
  rate_sensitivity_100bps_nii_impact_gbp: number | null;
  unemployment_1ppt_npl_impact_bps: number | null;
  house_price_10pct_decline_ltv_breach_count: number | null;
}

export interface RiskResponse extends DataEnvelope {
  period: PeriodToken;
  portfolio_quality: PortfolioQuality;
  dpd_distribution: DpdDistribution;
  vintage_curves: VintageCurve[];
  concentration_risk: ConcentrationRisk;
  stress_indicators: StressIndicators;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projections types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectionMonthPoint {
  period: string;
  net_interest_income_p50: number | null;
  net_interest_income_p10: number | null;
  net_interest_income_p90: number | null;
}

export interface RevenueProjection {
  months: ProjectionMonthPoint[];
  year_end_total_p50: number | null;
  year_end_total_p10: number | null;
  year_end_total_p90: number | null;
}

export interface OriginationsProjection {
  months: Array<{
    period: string;
    volume_p50: number | null;
    volume_p10: number | null;
    volume_p90: number | null;
  }>;
  year_end_total_p50: number | null;
}

export interface NplProjection {
  months: Array<{
    period: string;
    npl_rate_p50: number | null;
    npl_rate_p10: number | null;
    npl_rate_p90: number | null;
  }>;
  year_end_npl_rate_p50: number | null;
}

export interface PlanComparison {
  revenue_plan: number | null;
  revenue_p50_gap_pct: number | null;
  npl_plan_ceiling: number | null;
  npl_p90_within_plan: boolean | null;
}

export interface ProjectionsResponse extends DataEnvelope {
  horizon_months: number;
  scenario: ScenarioToken;
  generated_at: string;
  revenue_projection: RevenueProjection;
  originations_projection: OriginationsProjection;
  npl_projection: NplProjection;
  plan_comparison: PlanComparison;
  scenario_assumptions: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Corporate types
// ─────────────────────────────────────────────────────────────────────────────

export interface UnitEconomicsLine {
  credit_card: number | null;
  mortgage: number | null;
  blended: number | null;
}

export interface CorporateResponse extends DataEnvelope {
  period: PeriodToken;
  people_metrics: {
    total_headcount: number | null;
    headcount_by_function: Record<string, number> | null;
    attrition_rate_annualised: number | null;
    revenue_per_fte: number | null;
    headcount_trend: Array<{ period: string; headcount: number }>;
  };
  unit_economics: {
    customer_acquisition_cost: UnitEconomicsLine;
    customer_lifetime_value_estimated: UnitEconomicsLine;
    ltv_cac_ratio: UnitEconomicsLine;
  };
  customer_base: {
    total_active_customers: number | null;
    new_customers_period: number | null;
    multi_product_customers: number | null;
    customer_tenure_avg_months: number | null;
    churn_rate_annualised: number | null;
  };
  regulatory_capital: {
    cet1_ratio: number | null;
    total_capital_ratio: number | null;
    leverage_ratio: number | null;
    lcr: number | null;
    rwa_gbp: number | null;
    regulatory_minimum_cet1: number | null;
    buffer_above_minimum_bps: number | null;
  };
  nps_and_quality: {
    nps_overall: number | null;
    nps_credit_card: number | null;
    nps_mortgage: number | null;
    fca_complaint_rate_per_1000: number | null;
    complaints_upheld_pct: number | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Narrative types
// ─────────────────────────────────────────────────────────────────────────────

export interface AiNarrativeRequest {
  period: PeriodToken;
  include_sections?: string[];
  tone?: "board_brief" | "management_update" | "technical";
}

export interface AiNarrativeResponse {
  generated_at: string;
  model: string;
  brief: {
    performance_summary: string;
    risk_highlights: string;
    strategic_focus: string;
  };
  data_snapshot: {
    nii: number | null;
    npl_rate: number | null;
    originations_volume: number | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP client
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

async function _getToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function _apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await _getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw Object.assign(new Error(err.detail ?? "API error"), {
      status: response.status,
    });
  }

  return response.json() as Promise<T>;
}

function _qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `?${q}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOverview(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
  dateFrom?: string,
  dateTo?: string,
): Promise<OverviewResponse> {
  const qs = _qs({ period, product, date_from: dateFrom, date_to: dateTo });
  return _apiFetch<OverviewResponse>(`/api/analytics/overview${qs}`);
}

export async function fetchFinancial(
  period: PeriodToken = "ytd",
  product: ProductFilter = "all",
  breakdown: "monthly" | "quarterly" = "monthly",
): Promise<FinancialResponse> {
  const qs = _qs({ period, product, breakdown });
  return _apiFetch<FinancialResponse>(`/api/analytics/financial${qs}`);
}

export async function fetchOperational(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
): Promise<OperationalResponse> {
  const qs = _qs({ period, product });
  return _apiFetch<OperationalResponse>(`/api/analytics/operational${qs}`);
}

export async function fetchRisk(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
): Promise<RiskResponse> {
  const qs = _qs({ period, product });
  return _apiFetch<RiskResponse>(`/api/analytics/risk${qs}`);
}

export async function fetchProjections(
  horizon: HorizonToken = "12m",
  product: ProductFilter = "all",
  scenario: ScenarioToken = "base",
): Promise<ProjectionsResponse> {
  const qs = _qs({ horizon, product, scenario });
  return _apiFetch<ProjectionsResponse>(`/api/analytics/projections${qs}`);
}

export async function fetchCorporate(
  period: PeriodToken = "ytd",
): Promise<CorporateResponse> {
  const qs = _qs({ period });
  return _apiFetch<CorporateResponse>(`/api/analytics/corporate${qs}`);
}

export async function postAiNarrative(
  body: AiNarrativeRequest,
): Promise<AiNarrativeResponse> {
  return _apiFetch<AiNarrativeResponse>("/api/analytics/ai-narrative", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function buildExportPdfUrl(
  period: PeriodToken = "mtd",
  product: ProductFilter = "all",
  sections: string[] = ["overview", "financial", "operational", "risk", "projections", "corporate"],
  demo = false,
): string {
  const qs = _qs({
    period,
    product,
    sections: sections.join(","),
    demo: demo ? "true" : undefined,
  });
  return `${API_BASE}/api/analytics/export/pdf${qs}`;
}
