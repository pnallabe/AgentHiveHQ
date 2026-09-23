"""
Macroeconomic Indicator and CCAR / DFAST Supervisory Stress Scenario Schemas.
Supports Proj 3 (CECL), Proj 11 (ALM / Interest Rate), and Proj 13 (Risk Pricing).
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CCARScenarioType(str, Enum):
    BASELINE = "baseline"
    ADVERSE = "adverse"
    SEVERELY_ADVERSE = "severely_adverse"
    CUSTOM_CUSTOM_STRESS = "custom_stress"


class MacroeconomicSeriesPoint(BaseModel):
    series_id: str = Field(..., description="FRED Code e.g. SOFR, CPIAUCSL, UNRATE, GS10")
    observation_date: date
    value: float
    description: Optional[str] = None


class MacroeconomicYieldCurve(BaseModel):
    as_of_date: date
    sofr_overnight: float
    treasury_1m: float
    treasury_3m: float
    treasury_6m: float
    treasury_1y: float
    treasury_2y: float
    treasury_5y: float
    treasury_10y: float
    treasury_30y: float


class CCARSupervisoryProjection(BaseModel):
    scenario_type: CCARScenarioType
    as_of_date: date
    projection_quarter: str = Field(..., pattern=r"^\d{4}-Q[1-4]$")
    
    unemployment_rate: float = Field(..., ge=0.0, le=30.0)
    real_gdp_growth_annualized: float = Field(..., ge=-30.0, le=30.0)
    cpi_inflation_rate: float = Field(..., ge=-10.0, le=30.0)
    mortgage_rate_30y: float = Field(..., ge=0.0, le=25.0)
    prime_rate: float = Field(..., ge=0.0, le=25.0)
    dow_jones_total_stock_index: float = Field(..., gt=0.0)
    house_price_index_change_pct: float = Field(..., ge=-50.0, le=50.0)
    commercial_real_estate_price_index_change_pct: float = Field(..., ge=-70.0, le=50.0)
