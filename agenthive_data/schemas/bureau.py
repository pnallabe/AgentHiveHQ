"""
Credit Bureau Tradeline, Inquiry, and Public Record Schemas (Tri-Merge).
Supports Experian, Equifax, and TransUnion normalized data.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


class BureauSource(str, Enum):
    EXPERIAN = "EXPERIAN"
    EQUIFAX = "EQUIFAX"
    TRANSUNION = "TRANSUNION"
    TRI_MERGE_SYNTHETIC = "TRI_MERGE_SYNTHETIC"


class TradelineAccountType(str, Enum):
    REVOLVING = "revolving"
    INSTALLMENT = "installment"
    MORTGAGE = "mortgage"
    AUTO = "auto"
    STUDENT = "student"
    OTHER = "other"


class AccountStatus(str, Enum):
    CURRENT = "current"
    PAST_DUE_30 = "past_due_30"
    PAST_DUE_60 = "past_due_60"
    PAST_DUE_90 = "past_due_90"
    PAST_DUE_120_PLUS = "past_due_120_plus"
    CHARGE_OFF = "charge_off"
    PAID_OFF = "paid_off"


class Tradeline(BaseModel):
    tradeline_id: str
    account_type: TradelineAccountType
    creditor_name: str
    opened_date: date
    credit_limit_or_orig_bal: float = Field(..., ge=0.0)
    current_balance: float = Field(..., ge=0.0)
    monthly_payment: float = Field(default=0.0, ge=0.0)
    status: AccountStatus = Field(default=AccountStatus.CURRENT)
    delinquency_history_30d_count: int = Field(default=0, ge=0)
    delinquency_history_60d_count: int = Field(default=0, ge=0)
    delinquency_history_90d_plus_count: int = Field(default=0, ge=0)
    revolving_utilization_pct: Optional[float] = Field(default=None, ge=0.0, le=500.0)


class CreditInquiry(BaseModel):
    inquiry_id: str
    inquiry_date: date
    bureau: BureauSource
    inquirer_name: str
    industry_type: str = Field(default="credit_card")
    is_hard_inquiry: bool = True


class PublicRecord(BaseModel):
    record_id: str
    record_type: str = Field(description="bankruptcy, tax_lien, judgment")
    filed_date: date
    amount: float = Field(default=0.0, ge=0.0)
    status: str = Field(default="discharged")


class BureauReport(BaseModel):
    bureau_report_id: str
    tenant_id: str
    applicant_id: str
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    bureau_source: BureauSource = Field(default=BureauSource.EXPERIAN)
    
    fico_score: int = Field(..., ge=300, le=850)
    vantage_score: Optional[int] = Field(default=None, ge=300, le=850)
    
    total_revolving_credit_limit: float = Field(default=0.0, ge=0.0)
    total_revolving_balance: float = Field(default=0.0, ge=0.0)
    total_installment_balance: float = Field(default=0.0, ge=0.0)
    total_monthly_debt_service: float = Field(default=0.0, ge=0.0)
    
    revolving_utilization_rate: float = Field(..., ge=0.0, le=100.0, description="Percentage utilization 0-100")
    
    total_inquiries_last_6m: int = Field(default=0, ge=0)
    total_inquiries_last_12m: int = Field(default=0, ge=0)
    
    tradelines: List[Tradeline] = Field(default_factory=list)
    inquiries: List[CreditInquiry] = Field(default_factory=list)
    public_records: List[PublicRecord] = Field(default_factory=list)

    @field_validator("revolving_utilization_rate")
    @classmethod
    def validate_utilization(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError(f"Revolving utilization rate must be between 0.0 and 100.0, got {v}")
        return v
