"""
Test Suite: Pydantic Schema Contracts & Boundary Validation.
Validates boundary constraints across Consumer Applications, Credit Bureau Reports, and Performance tapes.
"""

from datetime import datetime, date
import pytest
from pydantic import ValidationError

from agenthive_data.schemas.application import ConsumerApplication, ApplicationType
from agenthive_data.schemas.bureau import BureauReport, BureauSource
from agenthive_data.schemas.performance import MonthlyLoanPerformanceRecord, DelinquencyStatus


def test_consumer_application_valid():
    app = ConsumerApplication(
        application_id="APP_VALID_001",
        tenant_id="tenant_1",
        application_type=ApplicationType.CONSUMER_UNSECURED,
        applicant_id="CUST_100",
        first_name="Jane",
        last_name="Doe",
        ssn_last4="1234",
        zip_code="10001",
        state="NY",
        annual_income=95000.0,
        housing_cost_monthly=1800.0,
        employment_length_years=5.0,
        requested_amount=15000.0,
        requested_term_months=36,
        stated_fico_score=740,
    )
    assert app.annual_income == 95000.0
    assert app.stated_fico_score == 740


def test_consumer_application_invalid_fico():
    """Asserts that FICO score outside [300, 850] raises ValidationError."""
    with pytest.raises(ValidationError):
        ConsumerApplication(
            application_id="APP_INVALID_FICO",
            tenant_id="tenant_1",
            application_type=ApplicationType.CONSUMER_UNSECURED,
            applicant_id="CUST_101",
            first_name="John",
            last_name="Smith",
            ssn_last4="5678",
            zip_code="90210",
            state="CA",
            annual_income=60000.0,
            housing_cost_monthly=1200.0,
            employment_length_years=2.0,
            requested_amount=10000.0,
            requested_term_months=24,
            stated_fico_score=250,  # Invalid: < 300
        )


def test_bureau_report_utilization_boundary():
    """Asserts that utilization rate > 100% raises ValidationError."""
    with pytest.raises(ValidationError):
        BureauReport(
            bureau_report_id="BUR_INVALID_UTIL",
            tenant_id="tenant_1",
            applicant_id="CUST_102",
            bureau_source=BureauSource.EXPERIAN,
            fico_score=680,
            revolving_utilization_rate=150.0,  # Invalid: > 100.0
        )


def test_performance_record_upb_non_negative():
    """Asserts that UPB cannot be negative."""
    with pytest.raises(ValidationError):
        MonthlyLoanPerformanceRecord(
            loan_id="LN_NEG_UPB",
            tenant_id="tenant_1",
            as_of_date=date(2024, 1, 1),
            reporting_period="2024-01",
            loan_age_months=12,
            remaining_months_to_maturity=348,
            current_interest_rate=6.5,
            current_actual_upb=-500.0,  # Invalid: negative UPB
            delinquency_status=DelinquencyStatus.CURRENT,
        )
