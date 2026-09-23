"""
Consumer & Commercial Credit Application Schemas.
Enforces strict typing, value boundaries, multi-tenant isolation, and explicit temporal timestamps.
"""

from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ApplicationType(str, Enum):
    CONSUMER_UNSECURED = "consumer_unsecured"
    CONSUMER_AUTO = "consumer_auto"
    CONSUMER_MORTGAGE = "consumer_mortgage"
    COMMERCIAL_SME_LOAN = "commercial_sme_loan"
    COMMERCIAL_LINE_OF_CREDIT = "commercial_line_of_credit"


class ApplicationStatus(str, Enum):
    RECEIVED = "received"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    DECLINED = "declined"
    REFERRED = "referred"


class BaseApplication(BaseModel):
    application_id: str = Field(..., description="Unique application identifier")
    tenant_id: str = Field(..., description="Multi-tenant isolation key")
    as_of_date: datetime = Field(default_factory=datetime.utcnow, description="Application submission cutoff timestamp")
    application_type: ApplicationType = Field(..., description="Type of credit application")
    status: ApplicationStatus = Field(default=ApplicationStatus.RECEIVED, description="Current decisioning status")


class ConsumerApplication(BaseApplication):
    applicant_id: str = Field(..., description="Unique customer ID")
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    ssn_last4: str = Field(..., pattern=r"^\d{4}$")
    zip_code: str = Field(..., pattern=r"^\d{5}(-\d{4})?$")
    state: str = Field(..., pattern=r"^[A-Z]{2}$")
    
    annual_income: float = Field(..., ge=0.0, description="Stated annual gross income in USD")
    housing_cost_monthly: float = Field(..., ge=0.0, description="Monthly rent or mortgage payment")
    employment_status: str = Field(default="employed", description="Employed, Self-Employed, Retired, etc.")
    employment_length_years: float = Field(..., ge=0.0, le=70.0)
    
    requested_amount: float = Field(..., gt=0.0, description="Requested loan amount")
    requested_term_months: int = Field(..., gt=0, le=360)
    stated_purpose: str = Field(default="debt_consolidation")
    
    stated_fico_score: Optional[int] = Field(default=None, ge=300, le=850)
    
    @field_validator("annual_income")
    @classmethod
    def validate_income(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Annual income cannot be negative")
        return v


class CommercialApplication(BaseApplication):
    business_id: str = Field(..., description="EIN or Business Entity Identifier")
    legal_name: str = Field(..., min_length=1)
    dba_name: Optional[str] = None
    ein: str = Field(..., pattern=r"^\d{2}-\d{7}$")
    naics_code: str = Field(..., pattern=r"^\d{6}$", description="6-digit NAICS industry code")
    years_in_business: float = Field(..., ge=0.0, le=150.0)
    
    annual_revenue: float = Field(..., ge=0.0, description="Annual gross revenue in USD")
    requested_facility_limit: float = Field(..., gt=0.0)
    use_of_funds: str = Field(default="working_capital")
    
    guarantor_ssn_last4: Optional[str] = Field(default=None, pattern=r"^\d{4}$")
    guarantor_ownership_pct: float = Field(default=100.0, ge=0.0, le=100.0)
