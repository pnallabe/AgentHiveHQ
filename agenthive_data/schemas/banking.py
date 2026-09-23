"""
Plaid / Open-Banking Transaction and Cash Flow Schemas.
Models checking accounts, daily transaction streams, NSF flags, and recurring income.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class TransactionCategory(str, Enum):
    INCOME_PAYROLL = "income_payroll"
    INCOME_TRANSFER = "income_transfer"
    HOUSING_RENT_MORTGAGE = "housing_rent_mortgage"
    UTILITIES = "utilities"
    LOAN_PAYMENT = "loan_payment"
    DISCRETIONARY = "discretionary"
    DEBT_STACKING_MCA = "debt_stacking_mca"
    NSF_FEE = "nsf_fee"
    OTHER = "other"


class BankTransaction(BaseModel):
    transaction_id: str
    account_id: str
    tenant_id: str
    as_of_date: datetime
    transaction_date: date
    amount: float = Field(..., description="Positive for outflows/debits, negative for inflows/credits in Plaid standard")
    description: str
    category: TransactionCategory = Field(default=TransactionCategory.OTHER)
    merchant_name: Optional[str] = None
    is_recurring: bool = False
    is_pending: bool = False


class AccountBalance(BaseModel):
    account_id: str
    account_type: str = Field(default="checking", description="checking, savings, credit_card")
    current_balance: float
    available_balance: Optional[float] = None
    currency: str = Field(default="USD")
    last_updated: datetime = Field(default_factory=datetime.utcnow)


class OpenBankingFeed(BaseModel):
    feed_id: str
    tenant_id: str
    customer_id: str
    institution_id: str = Field(default="ins_1", description="Plaid ins_id e.g. ins_56")
    institution_name: str = Field(default="Chase")
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    
    accounts: List[AccountBalance] = Field(default_factory=list)
    transactions: List[BankTransaction] = Field(default_factory=list)
    
    avg_monthly_inflow_90d: float = Field(default=0.0, ge=0.0)
    avg_monthly_outflow_90d: float = Field(default=0.0, ge=0.0)
    nsf_overdraft_count_90d: int = Field(default=0, ge=0)
    mca_debt_stacking_detected: bool = False
