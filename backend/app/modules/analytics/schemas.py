"""Pydantic v2 response schemas for the Analytics API — Section 5.4.

All monetary values are in GBP unless otherwise noted.
All schemas carry ``data_availability``, ``missing_sources``, ``affected_kpis``,
and ``data_as_of`` so the frontend can render appropriate degradation banners.

Zero ``Any`` types.  Every field carries a ``description`` for the OpenAPI docs
and for the Pytest schema-completeness assertion.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Shared leaf types
# ─────────────────────────────────────────────────────────────────────────────

DataAvailability = Literal["full", "partial", "demo"]
ProductFilter = Literal["all", "credit_card", "mortgage"]
PeriodToken = Literal["mtd", "qtd", "ytd", "last_30", "last_90", "last_12m", "custom"]
ScenarioToken = Literal["base", "stress", "upside"]
HorizonToken = Literal["12m", "24m"]
WaterfallItemType = Literal["positive", "negative", "subtotal"]


class KpiValue(BaseModel):
    """A single KPI metric with its change vs a comparison period."""

    value: Optional[float] = Field(
        None,
        description="Computed KPI value; None when data source is unavailable.",
    )
    unit: str = Field(
        ...,
        description="Unit of measurement: GBP | ratio | count | bps | days | %",
    )
    delta_pct: Optional[float] = Field(
        None,
        description="Fractional change vs comparison period, e.g. 0.043 = +4.3%.",
    )
    vs: Optional[str] = Field(
        None,
        description="Comparison period label, e.g. 'prior_month', 'prior_quarter'.",
    )
    alert: Optional[bool] = Field(
        None,
        description="True when the value has breached the configured alert threshold.",
    )


class DataEnvelope(BaseModel):
    """Mixin fields present on every analytics response."""

    data_availability: DataAvailability = Field(
        "demo",
        description=(
            "full = all real-time sources available; "
            "partial = some sources missing; "
            "demo = serving pre-computed fixture data."
        ),
    )
    missing_sources: list[str] = Field(
        default_factory=list,
        description="Source identifiers that could not be reached (used in partial mode).",
    )
    affected_kpis: list[str] = Field(
        default_factory=list,
        description="KPI field names whose values are None due to missing sources.",
    )
    data_as_of: datetime = Field(
        ...,
        description="UTC timestamp of the underlying data snapshot.",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Overview
# ─────────────────────────────────────────────────────────────────────────────


class HeadlineKpis(BaseModel):
    """Six headline KPIs shown in the overview hero row."""

    total_revenue: KpiValue = Field(
        ..., description="Total interest + fee income for the period (GBP)."
    )
    net_interest_income: KpiValue = Field(
        ..., description="Interest income minus cost of funds (GBP)."
    )
    total_originations_volume: KpiValue = Field(
        ..., description="Total credit extended in the period (GBP)."
    )
    npl_rate: KpiValue = Field(
        ..., description="Non-performing loans as a fraction of total outstanding."
    )
    approval_rate: KpiValue = Field(
        ..., description="Proportion of applications approved in the period."
    )
    roe: KpiValue = Field(
        ..., description="Annualised return on equity (net income / average equity)."
    )


class ProductSplit(BaseModel):
    """Revenue and originations split between credit card and mortgage."""

    revenue_share: Optional[float] = Field(
        None, description="Fraction of total revenue attributable to this product."
    )
    originations_share: Optional[float] = Field(
        None, description="Fraction of total origination volume for this product."
    )


class PlanVsActualSummary(BaseModel):
    """High-level plan attainment indicators."""

    revenue_attainment: Optional[float] = Field(
        None, description="Actual revenue / plan revenue (1.0 = on plan)."
    )
    originations_attainment: Optional[float] = Field(
        None, description="Actual originations / plan originations."
    )
    npl_within_budget: Optional[bool] = Field(
        None, description="True when NPL rate is at or below the plan ceiling."
    )
    cost_income_ratio: Optional[dict[str, object]] = Field(
        None,
        description=(
            "Cost-income ratio actuals vs plan. "
            "Keys: actual (float), plan (float), status (str)."
        ),
    )


class TopRisk(BaseModel):
    """A single flagged risk surfaced on the overview page."""

    code: str = Field(
        ..., description="Machine-readable risk code, e.g. 'NIM_COMPRESSION'."
    )
    severity: Literal["low", "medium", "high"] = Field(
        ..., description="Severity tier for colour-coding in the UI."
    )
    description: str = Field(
        ..., description="Plain-English description for the executive audience."
    )


class OverviewResponse(DataEnvelope):
    """Full response body for GET /api/analytics/overview."""

    period: PeriodToken = Field(..., description="Period token as received in the request.")
    product_filter: ProductFilter = Field(
        ..., description="Product filter applied to all KPIs."
    )
    headline_kpis: HeadlineKpis = Field(
        ..., description="Six hero KPI values for the overview page."
    )
    product_split: dict[str, ProductSplit] = Field(
        ...,
        description=(
            "Revenue and originations split keyed by product: "
            "'credit_card' and 'mortgage'."
        ),
    )
    plan_vs_actual: PlanVsActualSummary = Field(
        ..., description="Summary of plan attainment for the period."
    )
    top_risks: list[TopRisk] = Field(
        default_factory=list, description="Ranked list of flagged risks (max 5)."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Financial
# ─────────────────────────────────────────────────────────────────────────────


class IncomeStatement(BaseModel):
    """P&L line items for the selected period."""

    interest_income: Optional[float] = Field(
        None, description="Gross interest income (GBP)."
    )
    fee_income: Optional[float] = Field(None, description="Fee and non-interest income (GBP).")
    total_revenue: Optional[float] = Field(
        None, description="Interest income + fee income (GBP)."
    )
    cost_of_funds: Optional[float] = Field(
        None, description="Funding cost (GBP, positive = cost)."
    )
    net_interest_income: Optional[float] = Field(
        None, description="Total revenue minus cost of funds (GBP)."
    )
    operating_costs: Optional[float] = Field(
        None, description="Total operating expenditure (GBP)."
    )
    ecl_charge: Optional[float] = Field(
        None, description="Expected credit loss charge for the period (GBP)."
    )
    profit_before_tax: Optional[float] = Field(
        None, description="NII minus operating costs and ECL (GBP)."
    )


class Margins(BaseModel):
    """Key profitability ratios."""

    net_interest_margin: Optional[float] = Field(
        None, description="NII / average interest-earning assets (annualised)."
    )
    nim_by_product: Optional[dict[str, float]] = Field(
        None,
        description="NIM broken down by product: credit_card and mortgage.",
    )
    cost_income_ratio: Optional[float] = Field(
        None, description="Operating costs / total income."
    )
    return_on_equity: Optional[float] = Field(
        None, description="Annualised net income / average equity."
    )
    return_on_assets: Optional[float] = Field(
        None, description="Annualised net income / average total assets."
    )


class RevenueTrendPoint(BaseModel):
    """One time-bucket for the revenue trend chart."""

    period: str = Field(..., description="ISO year-month label, e.g. '2026-01'.")
    interest_income: Optional[float] = Field(None, description="Gross interest income (GBP).")
    fee_income: Optional[float] = Field(None, description="Non-interest income (GBP).")
    cost_of_funds: Optional[float] = Field(None, description="Cost of funds for the bucket (GBP).")


class WaterfallItem(BaseModel):
    """One bar in the P&L waterfall chart."""

    label: str = Field(..., description="Display label for the bar.")
    value: float = Field(..., description="Signed value (negative = outflow, GBP).")
    type: WaterfallItemType = Field(
        ...,
        description="Bar semantic: positive | negative | subtotal.",
    )


class WaterfallData(BaseModel):
    """Container for the P&L waterfall items."""

    items: list[WaterfallItem] = Field(
        ..., description="Ordered list of waterfall bars from top to bottom of P&L."
    )


class FinancialResponse(DataEnvelope):
    """Full response body for GET /api/analytics/financial."""

    period: PeriodToken = Field(..., description="Period token as received.")
    income_statement: IncomeStatement = Field(
        ..., description="P&L summary for the period."
    )
    margins: Margins = Field(..., description="Key profitability ratios.")
    revenue_trend: list[RevenueTrendPoint] = Field(
        default_factory=list,
        description="Period-by-period revenue breakdown for the trend chart.",
    )
    waterfall: WaterfallData = Field(
        ..., description="P&L build-up data for the waterfall chart."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Operational
# ─────────────────────────────────────────────────────────────────────────────


class ByProductOriginations(BaseModel):
    """Originations breakdown for a single product."""

    count: Optional[int] = Field(None, description="Number of accounts originated.")
    volume_gbp: Optional[float] = Field(None, description="Total credit extended (GBP).")
    avg_line: Optional[float] = Field(
        None, description="Average credit limit (credit card, GBP)."
    )
    avg_loan: Optional[float] = Field(
        None, description="Average loan amount (mortgage, GBP)."
    )


class OriginationsTrendPoint(BaseModel):
    """One period entry for the originations trend chart."""

    period: str = Field(..., description="ISO year-month label.")
    count: Optional[int] = Field(None, description="Origination count in the period.")
    volume: Optional[float] = Field(None, description="Origination volume in the period (GBP).")


class Originations(BaseModel):
    """Originations summary for the operational page."""

    total_count: Optional[int] = Field(None, description="Total originations in the period.")
    total_volume_gbp: Optional[float] = Field(
        None, description="Total origination volume (GBP)."
    )
    by_product: Optional[dict[str, ByProductOriginations]] = Field(
        None, description="Per-product breakdown keyed by 'credit_card' and 'mortgage'."
    )
    by_channel: Optional[dict[str, float]] = Field(
        None,
        description=(
            "Channel mix as fractions summing to 1.0. "
            "Keys: digital, branch, broker."
        ),
    )
    trend: list[OriginationsTrendPoint] = Field(
        default_factory=list,
        description="Period-by-period originations for the trend chart.",
    )


class CreditCardOps(BaseModel):
    """CC-specific operational KPIs."""

    average_credit_limit: Optional[float] = Field(
        None, description="Mean approved credit limit across active accounts (GBP)."
    )
    average_utilisation: Optional[float] = Field(
        None, description="Mean utilisation rate (balance / credit limit)."
    )
    activation_rate_30d: Optional[float] = Field(
        None, description="Fraction of new accounts with at least one transaction within 30 days."
    )
    average_apr: Optional[float] = Field(
        None, description="Portfolio weighted-average APR (%)."
    )
    approval_rate: Optional[float] = Field(
        None, description="Approved / (approved + declined) in the period."
    )
    stp_rate: Optional[float] = Field(
        None, description="Fraction of decisions made without manual intervention."
    )
    average_decision_time_seconds: Optional[float] = Field(
        None, description="Mean automated decision latency (seconds)."
    )


class MortgageOps(BaseModel):
    """Mortgage-specific operational KPIs."""

    pipeline_count: Optional[int] = Field(
        None, description="Active applications in the pipeline."
    )
    pipeline_value_gbp: Optional[float] = Field(
        None, description="Total value of in-flight applications (GBP)."
    )
    pipeline_by_stage: Optional[dict[str, int]] = Field(
        None,
        description=(
            "Application counts by processing stage: "
            "document_collection, valuation, underwriting, offer_issued."
        ),
    )
    average_ltv: Optional[float] = Field(
        None, description="Portfolio weighted-average LTV ratio."
    )
    stp_rate: Optional[float] = Field(
        None, description="Fraction of mortgage applications processed without manual touchpoint."
    )
    average_time_to_offer_days: Optional[float] = Field(
        None, description="Mean elapsed days from application submit to offer letter."
    )
    approval_rate: Optional[float] = Field(None, description="Mortgage approval rate.")
    average_dti: Optional[float] = Field(
        None, description="Portfolio weighted-average debt-to-income ratio."
    )


class CustomerService(BaseModel):
    """CX quality KPIs."""

    complaint_rate_per_1000: Optional[float] = Field(
        None, description="FCA-reportable complaints per 1,000 accounts."
    )
    ppi_upheld_rate: Optional[float] = Field(
        None, description="Fraction of PPI complaints upheld (should be 0.0)."
    )
    complaints_resolved_within_8_weeks_pct: Optional[float] = Field(
        None, description="Fraction of complaints resolved within the FCA 8-week window."
    )
    nps_score: Optional[int] = Field(None, description="Net Promoter Score (-100 to +100).")


class OperationalResponse(DataEnvelope):
    """Full response body for GET /api/analytics/operational."""

    period: PeriodToken = Field(..., description="Period token as received.")
    originations: Originations = Field(
        ..., description="Originations volume and channel breakdown."
    )
    credit_card_ops: CreditCardOps = Field(
        ..., description="Credit card operational KPIs."
    )
    mortgage_ops: MortgageOps = Field(
        ..., description="Mortgage operational KPIs including pipeline."
    )
    customer_service: CustomerService = Field(
        ..., description="CX quality and FCA complaint metrics."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Risk
# ─────────────────────────────────────────────────────────────────────────────


class ProductQuality(BaseModel):
    """Asset quality breakdown for a single product."""

    outstanding: Optional[float] = Field(
        None, description="Total outstanding balance (GBP)."
    )
    npl_rate: Optional[float] = Field(None, description="NPL rate for this product.")
    ecl: Optional[float] = Field(
        None, description="ECL provision for this product (GBP)."
    )


class PortfolioQuality(BaseModel):
    """Top-level portfolio asset quality metrics."""

    total_outstanding_gbp: Optional[float] = Field(
        None, description="Total book outstanding balance (GBP)."
    )
    npl_balance_gbp: Optional[float] = Field(
        None, description="Total non-performing loan balance (GBP)."
    )
    npl_rate: Optional[float] = Field(
        None, description="NPL balance / total outstanding."
    )
    ecl_provision_gbp: Optional[float] = Field(
        None, description="IFRS 9 ECL provision (GBP)."
    )
    provision_coverage_ratio: Optional[float] = Field(
        None, description="ECL provision / NPL balance."
    )
    net_charge_off_rate_annualised: Optional[float] = Field(
        None, description="Annualised net charge-off rate."
    )
    by_product: Optional[dict[str, ProductQuality]] = Field(
        None,
        description="Per-product quality metrics keyed by 'credit_card' and 'mortgage'.",
    )


class DpdDistribution(BaseModel):
    """DPD bucket distribution (fractions summing to approximately 1.0)."""

    current: Optional[float] = Field(None, description="Fraction of accounts current (0 DPD).")
    dpd_1_29: Optional[float] = Field(None, description="Fraction of accounts 1–29 DPD.")
    dpd_30_59: Optional[float] = Field(None, description="Fraction 30–59 DPD.")
    dpd_60_89: Optional[float] = Field(None, description="Fraction 60–89 DPD.")
    dpd_90_plus: Optional[float] = Field(None, description="Fraction 90+ DPD (NPL territory).")


class VintageDataPoint(BaseModel):
    """One MOB-level data point on a vintage default curve."""

    months_on_book: int = Field(..., description="Months since origination.")
    cumulative_default_rate: float = Field(
        ..., description="Cumulative default rate at this MOB."
    )


class VintageCurve(BaseModel):
    """Default curve for a single origination cohort."""

    cohort: str = Field(
        ..., description="Origination cohort label in ISO year-month format."
    )
    product_type: str = Field(
        ..., description="Product for this cohort: 'credit_card' or 'mortgage'."
    )
    data_points: list[VintageDataPoint] = Field(
        ..., description="MOB-by-MOB cumulative default rate data."
    )


class ConcentrationRisk(BaseModel):
    """Portfolio concentration risk indicators."""

    top_10_borrower_pct_of_portfolio: Optional[float] = Field(
        None,
        description=(
            "Fraction of portfolio outstanding held by the top-10 borrowers "
            "(should be low for retail books)."
        ),
    )
    geography: Optional[dict[str, float]] = Field(
        None,
        description="Geographic concentration by region as fractions.",
    )
    ltv_bands_mortgage: Optional[dict[str, float]] = Field(
        None,
        description=(
            "LTV band distribution for the mortgage book. "
            "Keys: under_60, 60_to_75, 75_to_85, over_85."
        ),
    )


class StressIndicators(BaseModel):
    """Point-in-time stress test outputs."""

    rate_sensitivity_100bps_nii_impact_gbp: Optional[float] = Field(
        None,
        description="NII impact of a parallel +100bps rate shock (GBP, negative = loss).",
    )
    unemployment_1ppt_npl_impact_bps: Optional[float] = Field(
        None,
        description="Estimated increase in NPL rate (bps) from a +1pp unemployment shock.",
    )
    house_price_10pct_decline_ltv_breach_count: Optional[int] = Field(
        None,
        description="Number of mortgage accounts breaching 85% LTV after a 10% HPI decline.",
    )


class RiskResponse(DataEnvelope):
    """Full response body for GET /api/analytics/risk."""

    period: PeriodToken = Field(..., description="Period token as received.")
    portfolio_quality: PortfolioQuality = Field(
        ..., description="Asset quality overview for the full book."
    )
    dpd_distribution: DpdDistribution = Field(
        ..., description="DPD bucket mix as fractions."
    )
    vintage_curves: list[VintageCurve] = Field(
        default_factory=list,
        description="Last 8 origination cohorts as default-rate curves.",
    )
    concentration_risk: ConcentrationRisk = Field(
        ..., description="Geographic, borrower, and LTV concentration metrics."
    )
    stress_indicators: StressIndicators = Field(
        ..., description="Sensitivity and stress test outputs."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Projections
# ─────────────────────────────────────────────────────────────────────────────


class ProjectionMonthPoint(BaseModel):
    """One month of a revenue projection band."""

    period: str = Field(..., description="ISO year-month label for the projection month.")
    net_interest_income_p50: Optional[float] = Field(
        None, description="Median projected NII (GBP)."
    )
    net_interest_income_p10: Optional[float] = Field(
        None, description="10th-percentile (downside) projected NII (GBP)."
    )
    net_interest_income_p90: Optional[float] = Field(
        None, description="90th-percentile (upside) projected NII (GBP)."
    )


class RevenueProjection(BaseModel):
    """Monte Carlo revenue projection with confidence bands."""

    months: list[ProjectionMonthPoint] = Field(
        default_factory=list,
        description="Month-by-month projection data.",
    )
    year_end_total_p50: Optional[float] = Field(
        None, description="Median year-end total NII (GBP)."
    )
    year_end_total_p10: Optional[float] = Field(
        None, description="10th-percentile year-end total NII (GBP)."
    )
    year_end_total_p90: Optional[float] = Field(
        None, description="90th-percentile year-end total NII (GBP)."
    )


class OriginationsProjectionPoint(BaseModel):
    """One month of an originations projection band."""

    period: str = Field(..., description="ISO year-month label.")
    volume_p50: Optional[float] = Field(None, description="Median projected originations (GBP).")
    volume_p10: Optional[float] = Field(None, description="10th-percentile originations (GBP).")
    volume_p90: Optional[float] = Field(None, description="90th-percentile originations (GBP).")


class OriginationsProjection(BaseModel):
    """Originations volume projection with confidence bands."""

    months: list[OriginationsProjectionPoint] = Field(
        default_factory=list, description="Month-by-month originations projection."
    )
    year_end_total_p50: Optional[float] = Field(
        None, description="Median year-end total originations (GBP)."
    )


class NplProjectionPoint(BaseModel):
    """One month of an NPL rate projection band."""

    period: str = Field(..., description="ISO year-month label.")
    npl_rate_p50: Optional[float] = Field(None, description="Median projected NPL rate.")
    npl_rate_p10: Optional[float] = Field(None, description="10th-percentile NPL rate.")
    npl_rate_p90: Optional[float] = Field(None, description="90th-percentile NPL rate.")


class NplProjection(BaseModel):
    """NPL rate projection with confidence bands."""

    months: list[NplProjectionPoint] = Field(
        default_factory=list, description="Month-by-month NPL rate projection."
    )
    year_end_npl_rate_p50: Optional[float] = Field(
        None, description="Median year-end NPL rate."
    )


class PlanComparison(BaseModel):
    """Summary of projection vs business plan."""

    revenue_plan: Optional[float] = Field(
        None, description="Board-approved revenue plan for the year (GBP)."
    )
    revenue_p50_gap_pct: Optional[float] = Field(
        None,
        description="(p50 projection - plan) / plan — negative means below plan.",
    )
    npl_plan_ceiling: Optional[float] = Field(
        None, description="Board-approved NPL rate ceiling."
    )
    npl_p90_within_plan: Optional[bool] = Field(
        None,
        description="True when even the 90th-percentile NPL projection stays below the ceiling.",
    )


class ProjectionsResponse(DataEnvelope):
    """Full response body for GET /api/analytics/projections."""

    horizon_months: int = Field(..., description="Projection horizon in months (12 or 24).")
    scenario: ScenarioToken = Field(
        ..., description="Macro scenario applied to the Monte Carlo simulation."
    )
    generated_at: datetime = Field(
        ..., description="UTC timestamp when the projection was computed."
    )
    revenue_projection: RevenueProjection = Field(
        ..., description="NII projection with p10/p50/p90 confidence bands."
    )
    originations_projection: OriginationsProjection = Field(
        ..., description="Originations volume projection with confidence bands."
    )
    npl_projection: NplProjection = Field(
        ..., description="NPL rate projection with confidence bands."
    )
    plan_comparison: PlanComparison = Field(
        ..., description="Projection vs business plan summary."
    )
    scenario_assumptions: dict[str, str] = Field(
        ...,
        description=(
            "Human-readable macro assumptions for each scenario key. "
            "Keys: base, stress, upside."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Corporate
# ─────────────────────────────────────────────────────────────────────────────


class HeadcountTrendPoint(BaseModel):
    """One period entry for the headcount trend chart."""

    period: str = Field(..., description="ISO year-month label.")
    headcount: int = Field(..., description="Total headcount at end of period.")


class PeopleMetrics(BaseModel):
    """Workforce KPIs for the corporate page."""

    total_headcount: Optional[int] = Field(None, description="Total FTE count.")
    headcount_by_function: Optional[dict[str, int]] = Field(
        None,
        description=(
            "Headcount broken down by function: "
            "technology, risk_and_compliance, operations, "
            "sales_and_distribution, finance, other."
        ),
    )
    attrition_rate_annualised: Optional[float] = Field(
        None, description="Annualised voluntary attrition rate."
    )
    revenue_per_fte: Optional[float] = Field(
        None, description="Total revenue / total FTE (GBP)."
    )
    headcount_trend: list[HeadcountTrendPoint] = Field(
        default_factory=list, description="Period-by-period headcount for the trend chart."
    )


class UnitEconomicsLine(BaseModel):
    """CAC and CLV by product."""

    credit_card: Optional[float] = Field(None, description="Credit card figure.")
    mortgage: Optional[float] = Field(None, description="Mortgage figure.")
    blended: Optional[float] = Field(None, description="Book-weighted blended figure.")


class UnitEconomics(BaseModel):
    """Customer acquisition cost and lifetime value."""

    customer_acquisition_cost: UnitEconomicsLine = Field(
        ..., description="CAC by product (GBP)."
    )
    customer_lifetime_value_estimated: UnitEconomicsLine = Field(
        ..., description="Estimated CLV by product (GBP)."
    )
    ltv_cac_ratio: UnitEconomicsLine = Field(
        ..., description="CLV / CAC ratio by product (higher is better)."
    )


class CustomerBase(BaseModel):
    """Customer base composition metrics."""

    total_active_customers: Optional[int] = Field(
        None, description="Total accounts with at least one credit product."
    )
    new_customers_period: Optional[int] = Field(
        None, description="New customer acquisitions in the period."
    )
    multi_product_customers: Optional[float] = Field(
        None, description="Fraction of customers holding ≥ 2 products."
    )
    customer_tenure_avg_months: Optional[float] = Field(
        None, description="Average months on book across active customers."
    )
    churn_rate_annualised: Optional[float] = Field(
        None, description="Annualised account closure rate."
    )


class RegulatoryCapital(BaseModel):
    """Basel III / CRD IV capital adequacy metrics."""

    cet1_ratio: Optional[float] = Field(
        None, description="Common Equity Tier 1 ratio (CET1 capital / RWA)."
    )
    total_capital_ratio: Optional[float] = Field(
        None, description="Total capital / RWA."
    )
    leverage_ratio: Optional[float] = Field(
        None, description="Tier 1 capital / total exposures."
    )
    lcr: Optional[float] = Field(
        None, description="Liquidity Coverage Ratio."
    )
    rwa_gbp: Optional[float] = Field(
        None, description="Risk-weighted assets (GBP)."
    )
    regulatory_minimum_cet1: Optional[float] = Field(
        None, description="Regulatory minimum CET1 ratio (typically 8%)."
    )
    buffer_above_minimum_bps: Optional[int] = Field(
        None,
        description="(actual_cet1 - regulatory_minimum) × 10,000, expressed in basis points.",
    )


class NpsAndQuality(BaseModel):
    """Net Promoter Score and FCA quality metrics."""

    nps_overall: Optional[int] = Field(None, description="Overall NPS (-100 to +100).")
    nps_credit_card: Optional[int] = Field(None, description="Credit card NPS.")
    nps_mortgage: Optional[int] = Field(None, description="Mortgage NPS.")
    fca_complaint_rate_per_1000: Optional[float] = Field(
        None, description="FCA-reportable complaints per 1,000 accounts."
    )
    complaints_upheld_pct: Optional[float] = Field(
        None, description="Fraction of complaints upheld by the firm."
    )


class CorporateResponse(DataEnvelope):
    """Full response body for GET /api/analytics/corporate."""

    period: PeriodToken = Field(..., description="Period token as received.")
    people_metrics: PeopleMetrics = Field(
        ..., description="Workforce composition and productivity KPIs."
    )
    unit_economics: UnitEconomics = Field(
        ..., description="CAC, CLV, and LTV:CAC by product."
    )
    customer_base: CustomerBase = Field(
        ..., description="Customer base composition and tenure."
    )
    regulatory_capital: RegulatoryCapital = Field(
        ..., description="Basel III capital adequacy with alert threshold."
    )
    nps_and_quality: NpsAndQuality = Field(
        ..., description="NPS by product and FCA complaint quality metrics."
    )


# ─────────────────────────────────────────────────────────────────────────────
# AI Narrative
# ─────────────────────────────────────────────────────────────────────────────


class AiNarrativeRequest(BaseModel):
    """Request body for POST /api/analytics/ai-narrative."""

    period: PeriodToken = Field(..., description="Period token for the brief.")
    include_sections: list[Literal["financial", "operational", "risk", "projections", "corporate"]] = Field(
        default_factory=lambda: ["financial", "operational", "risk"],
        description="Dashboard sections to include as context for the LLM.",
    )
    tone: Literal["board_brief", "management_update", "technical"] = Field(
        "board_brief",
        description=(
            "Desired register: "
            "board_brief = concise, no jargon; "
            "management_update = more detail; "
            "technical = metrics-heavy."
        ),
    )


class ExecutiveBrief(BaseModel):
    """Three-bullet executive brief produced by the LLM."""

    performance_summary: str = Field(
        ..., description="One-sentence summary of revenue and margin performance."
    )
    risk_highlights: str = Field(
        ..., description="One-sentence summary of the most significant risk signal."
    )
    strategic_focus: str = Field(
        ..., description="One-sentence operational recommendation for the leadership team."
    )


class DataSnapshot(BaseModel):
    """Key figures injected into the LLM prompt and echoed in the response."""

    nii: Optional[float] = Field(None, description="Net interest income for the period (GBP).")
    npl_rate: Optional[float] = Field(None, description="NPL rate used as LLM prompt context.")
    originations_volume: Optional[float] = Field(
        None, description="Total originations volume (GBP)."
    )


class AiNarrativeResponse(BaseModel):
    """Full response body for POST /api/analytics/ai-narrative."""

    generated_at: datetime = Field(
        ..., description="UTC timestamp when the narrative was generated."
    )
    model: str = Field(
        ..., description="Model identifier used, e.g. 'gemini-2.0-flash'."
    )
    brief: ExecutiveBrief = Field(..., description="Three-bullet executive brief.")
    data_snapshot: DataSnapshot = Field(
        ..., description="Key metrics used as LLM context (auditable)."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Export
# ─────────────────────────────────────────────────────────────────────────────

AnalyticsSection = Literal[
    "overview", "financial", "operational", "risk", "projections", "corporate"
]


class ExportRequest(BaseModel):
    """Query parameters for GET /api/analytics/export/pdf (modelled as a schema for docs)."""

    period: PeriodToken = Field("mtd", description="Period to include in the export.")
    product: ProductFilter = Field("all", description="Product filter for the export.")
    sections: list[AnalyticsSection] = Field(
        default_factory=lambda: [
            "overview", "financial", "operational", "risk", "projections", "corporate"
        ],
        description="Dashboard sections to include in the PDF.",
    )
    demo: bool = Field(
        False,
        description=(
            "When True the PDF carries a 'SAMPLE DATA' watermark "
            "and no real customer data is included."
        ),
    )
