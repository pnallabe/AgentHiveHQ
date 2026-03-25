/**
 * AgentHive – AI Credit Decisioning Platform
 * Shared TypeScript types for the Lab API client and UI components.
 * These mirror the FastAPI Pydantic schemas exactly — keep in sync.
 */

// ---------------------------------------------------------------------------
// Underwriting
// ---------------------------------------------------------------------------

export type HousingStatus = "own" | "mortgage" | "rent";
export type Decision = "approve" | "reject" | "review";
export type RiskSegment = "prime" | "near_prime" | "high_risk" | "thin_file";

export interface UnderwritingRequest {
  income: number;
  employment_length: number;
  housing_status: HousingStatus;
  /** null = no credit history (thin file) */
  credit_score: number | null;
  scenario_tag?: string;
  demo_mode: boolean;
}

export interface DecisionAudit {
  timestamp: string; // ISO 8601 UTC
  model_version: string;
  model_artifact_hash: string;
  rules_evaluated: number;
  rules_triggered: string[];
  rules_overridden: boolean;
  demo_mode: boolean;
}

export interface UnderwritingResponse {
  decision_id: string; // UUID v7
  decision: Decision;
  credit_limit: number;
  apr: number;
  confidence_score: number; // 0–1
  risk_segment: RiskSegment;
  reason_codes: string[];
  fcra_codes: string[];
  /** SHAP value per feature; positive = supports approval */
  explanations: Record<string, number>;
  audit: DecisionAudit;
}

// ---------------------------------------------------------------------------
// Decision History
// ---------------------------------------------------------------------------

export interface DecisionRecord {
  id: string;
  created_at: string;
  applicant_ref: string | null;
  input_payload: UnderwritingRequest;
  decision: Decision;
  credit_limit: number;
  apr: number;
  confidence_score: number;
  risk_segment: RiskSegment;
  reason_codes: string[];
  shap_values: Record<string, number>;
  model_version: string;
  rules_triggered: string[];
  demo_mode: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface HistoryParams {
  page?: number;
  page_size?: number;
  decision?: Decision | "all";
  demo_mode?: boolean;
}

// ---------------------------------------------------------------------------
// Copilot
// ---------------------------------------------------------------------------

export interface CopilotRequest {
  decision_response: UnderwritingResponse;
  applicant_context?: string;
}

export interface CopilotResponse {
  narrative: string;
  risk_flags: string[];
  recommendations: string[];
  plain_english_apr: string;
}

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

export interface SegmentBreakdown {
  prime: number;
  near_prime: number;
  high_risk: number;
  thin_file: number;
}

export interface RuleFrequency {
  minimum_income: number;
  thin_file_review: number;
  very_low_credit_score: number;
  negative_employment: number;
}

export interface TopReasonCode {
  code: string;
  count: number;
  pct: number;
}

export interface GovernanceDashboard {
  period: string;
  total_decisions: number;
  approval_rate: number;
  average_credit_limit: number;
  average_apr: number;
  decisions_by_segment: SegmentBreakdown;
  approval_rate_by_segment: SegmentBreakdown;
  rules_triggered_frequency: RuleFrequency;
  top_reason_codes: TopReasonCode[];
}

export interface IncomeBandStats {
  total: number;
  approved: number;
  rate: number;
}

export interface BiasReport {
  disclaimer: string;
  income_band_analysis: {
    band_0_under_25k: IncomeBandStats;
    band_1_25k_50k: IncomeBandStats;
    band_2_50k_100k: IncomeBandStats;
    band_3_over_100k: IncomeBandStats;
  };
  adverse_impact_ratio: number;
  disparate_impact_flag: boolean;
  disparate_impact_threshold: number;
}

// ---------------------------------------------------------------------------
// RFC 7807 Problem Detail (error shape from FastAPI)
// ---------------------------------------------------------------------------

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}
