"""
Commercial & Small Business (SMB) Financial Schemas.
Models IRS Form 1120-S & Form 1040 extracted line items, balance sheets, P&L statements, MCA debt stacking, and UBO network graphs.
"""

from datetime import date, datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class IRSForm1120S(BaseModel):
    tax_year: int = Field(..., ge=2000, le=2030)
    business_id: str
    tenant_id: str
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    
    # Page 1 Income & Deductions
    gross_receipts_or_sales: float = Field(..., ge=0.0)
    returns_and_allowances: float = Field(default=0.0, ge=0.0)
    cost_of_goods_sold: float = Field(default=0.0, ge=0.0)
    gross_profit: float = Field(..., description="Gross receipts minus COGS")
    
    total_income: float
    officer_compensation: float = Field(default=0.0, ge=0.0)
    salaries_and_wages: float = Field(default=0.0, ge=0.0)
    repairs_and_maintenance: float = Field(default=0.0, ge=0.0)
    bad_debts: float = Field(default=0.0, ge=0.0)
    rents: float = Field(default=0.0, ge=0.0)
    taxes_and_licenses: float = Field(default=0.0, ge=0.0)
    interest_deduction: float = Field(default=0.0, ge=0.0)
    depreciation: float = Field(default=0.0, ge=0.0)
    total_deductions: float
    ordinary_business_income_loss: float = Field(..., description="Line 21 Ordinary income/loss")
    
    # Schedule L Balance Sheet
    cash_beginning: float = Field(default=0.0)
    cash_ending: float = Field(default=0.0)
    trade_notes_receivable_ending: float = Field(default=0.0)
    inventories_ending: float = Field(default=0.0)
    total_assets_ending: float = Field(..., ge=0.0)
    total_liabilities_ending: float = Field(..., ge=0.0)
    total_shareholders_equity_ending: float = Field(default=0.0)


class UltimateBeneficialOwner(BaseModel):
    owner_id: str
    full_name: str
    ssn_last4: str = Field(..., pattern=r"^\d{4}$")
    ownership_percentage: float = Field(..., ge=0.0, le=100.0)
    title: str = Field(default="CEO")
    is_control_person: bool = True
    ofac_sanctions_hit: bool = False
    pep_status: bool = False


class CommercialEntityGraph(BaseModel):
    business_id: str
    tenant_id: str
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    legal_name: str
    ein: str
    naics_code: str
    
    beneficial_owners: List[UltimateBeneficialOwner] = Field(default_factory=list)
    subsidiary_business_ids: List[str] = Field(default_factory=list)
    parent_company_id: Optional[str] = None
    
    mca_lenders_active_count: int = Field(default=0, ge=0, description="Active merchant cash advance daily debits detected")
    mca_est_daily_withholding: float = Field(default=0.0, ge=0.0)
    dscr_ratio: Optional[float] = Field(default=None, description="Debt Service Coverage Ratio")
