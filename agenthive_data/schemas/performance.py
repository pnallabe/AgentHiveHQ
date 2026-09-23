"""
Longitudinal Monthly Loan Performance Tape Schemas.
Aligned with Fannie Mae SFLLD & SEC ABS-EE institutional disclosure standards.
Supports CECL / IFRS 9 life-of-loan survival panels, roll-rate transition matrix, LGD & EAD modeling.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class DelinquencyStatus(str, Enum):
    CURRENT = "0"
    DAYS_30 = "1"
    DAYS_60 = "2"
    DAYS_90 = "3"
    DAYS_120_PLUS = "4"
    DEFAULT_CHARGE_OFF = "C"
    PREPAID_PAID_OFF = "P"
    RESTRUCTURED = "R"


class MonthlyLoanPerformanceRecord(BaseModel):
    loan_id: str = Field(..., description="Unique loan identifier")
    tenant_id: str = Field(..., description="Multi-tenant isolation key")
    as_of_date: date = Field(..., description="Reporting month cutoff date (YYYY-MM-01)")
    
    reporting_period: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM reporting month")
    loan_age_months: int = Field(..., ge=0, le=480)
    remaining_months_to_maturity: int = Field(..., ge=0, le=480)
    
    current_interest_rate: float = Field(..., ge=0.0, le=50.0)
    current_actual_upb: float = Field(..., ge=0.0, description="Unpaid Principal Balance at month end")
    scheduled_principal_payment: float = Field(default=0.0, ge=0.0)
    actual_principal_payment: float = Field(default=0.0, ge=0.0)
    
    delinquency_status: DelinquencyStatus = Field(default=DelinquencyStatus.CURRENT)
    modification_flag: bool = False
    zero_balance_code: Optional[str] = Field(default=None, description="01=Prepaid, 03=Charge-off, 09=Short Sale")
    zero_balance_effective_date: Optional[date] = None
    
    # Workout & Recovery metrics (LGD/EAD)
    credit_enhancement_coverage: float = Field(default=0.0, ge=0.0)
    cumulative_cash_recoveries: float = Field(default=0.0, ge=0.0)
    liquidation_expenses: float = Field(default=0.0, ge=0.0)
    estimated_drawn_at_default_ead: Optional[float] = Field(default=None, ge=0.0)

    @field_validator("current_actual_upb")
    @classmethod
    def validate_upb(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Unpaid Principal Balance cannot be negative")
        return v


class LoanPerformanceTape(BaseModel):
    tape_id: str
    tenant_id: str
    portfolio_name: str = Field(default="Consumer_Unsecured_2024_Q1")
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    records: List[MonthlyLoanPerformanceRecord] = Field(default_factory=list)
    total_loans: int = Field(default=0, ge=0)
    total_original_upb: float = Field(default=0.0, ge=0.0)
