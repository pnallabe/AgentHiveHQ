"""
Financial Crimes, Transaction Streams, Device Telemetry, and Mule Graph Schemas.
Supports Proj 4 (Fraud & APP Scams) and Proj 8 (Collections Uplift / Dialer logs).
"""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class TransactionChannel(str, Enum):
    MOBILE_APP = "mobile_app"
    WEB_BROWSER = "web_browser"
    ATM = "atm"
    POS_TERMINAL = "pos_terminal"
    ACH_TRANSFER = "ach_transfer"
    WIRE = "wire"


class FraudRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL_BLOCK = "critical_block"


class DeviceTelemetry(BaseModel):
    device_hash: str
    ip_address: str
    ip_subnet_fips: Optional[str] = None
    user_agent: str
    is_vpn_or_proxy: bool = False
    is_emulator: bool = False
    screen_resolution: Optional[str] = None
    location_lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    location_lon: Optional[float] = Field(default=None, ge=-180.0, le=180.0)


class RealtimeTransactionEvent(BaseModel):
    event_id: str
    tenant_id: str
    account_id: str
    customer_id: str
    as_of_date: datetime = Field(default_factory=datetime.utcnow)
    
    amount: float = Field(..., gt=0.0)
    currency: str = Field(default="USD")
    channel: TransactionChannel = Field(default=TransactionChannel.MOBILE_APP)
    
    payee_account_id: Optional[str] = None
    payee_routing_number: Optional[str] = None
    
    telemetry: Optional[DeviceTelemetry] = None
    
    velocity_1h_count: int = Field(default=1, ge=0)
    velocity_24h_amount: float = Field(default=0.0, ge=0.0)
    is_first_time_payee: bool = False
    
    fraud_risk_score: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    app_scam_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class MuleAccountGraphEdge(BaseModel):
    source_account_id: str
    target_account_id: str
    tenant_id: str
    first_transfer_timestamp: datetime
    last_transfer_timestamp: datetime
    total_transfer_volume: float = Field(..., ge=0.0)
    transfer_count: int = Field(..., ge=1)
    is_rapid_funnel: bool = False


class RegFDialerLog(BaseModel):
    log_id: str
    tenant_id: str
    customer_id: str
    loan_id: str
    attempt_timestamp: datetime
    channel: str = Field(default="phone_call", description="phone_call, sms, email, letter")
    disposition: str = Field(default="no_answer", description="answered, promise_to_pay, left_voicemail, no_answer")
    reg_f_weekly_call_count: int = Field(..., ge=0, le=7, description="CFPB Reg F limits to 7 calls in 7 consecutive days")
    promise_to_pay_amount: Optional[float] = Field(default=None, ge=0.0)
