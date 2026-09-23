"""
Longitudinal Loan Performance Panel Synthesizer.
Generates multi-year monthly loan performance tapes with calibrated Markov transition matrices for delinquency transitions,
prepayments, default right-censoring, and workout recovery cash flows.
"""

from datetime import date, datetime, timedelta
import random
from typing import List, Dict, Any, Optional
import numpy as np

from agenthive_data.schemas.performance import (
    MonthlyLoanPerformanceRecord,
    DelinquencyStatus,
    LoanPerformanceTape,
)


class LongitudinalPerformanceTapeSynthesizer:
    """Markov transition matrix panel generator for loan survival and CECL cash-flow modeling."""

    # Markov Transition Matrix: [Current, 30DQ, 60DQ, 90DQ, 120DQ, Default, Prepaid]
    # States: 0=Current, 1=30DQ, 2=60DQ, 3=90DQ, 4=120DQ, 5=Default, 6=Prepaid
    MARKOV_TRANSITION_MATRIX = np.array([
        [0.940, 0.035, 0.000, 0.000, 0.000, 0.005, 0.020],  # From Current
        [0.450, 0.350, 0.150, 0.000, 0.000, 0.030, 0.020],  # From 30DQ
        [0.200, 0.250, 0.300, 0.200, 0.000, 0.040, 0.010],  # From 60DQ
        [0.050, 0.100, 0.150, 0.350, 0.300, 0.045, 0.005],  # From 90DQ
        [0.010, 0.020, 0.050, 0.100, 0.200, 0.620, 0.000],  # From 120DQ
        [0.000, 0.000, 0.000, 0.000, 0.000, 1.000, 0.000],  # Default (Absorbing)
        [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 1.000],  # Prepaid (Absorbing)
    ])

    STATE_TO_ENUM = {
        0: DelinquencyStatus.CURRENT,
        1: DelinquencyStatus.DAYS_30,
        2: DelinquencyStatus.DAYS_60,
        3: DelinquencyStatus.DAYS_90,
        4: DelinquencyStatus.DAYS_120_PLUS,
        5: DelinquencyStatus.DEFAULT_CHARGE_OFF,
        6: DelinquencyStatus.PREPAID_PAID_OFF,
    }

    def __init__(self, tenant_id: str = "tenant_default", seed: Optional[int] = 42):
        self.tenant_id = tenant_id
        self.rng = np.random.default_rng(seed)

    def generate_loan_panel(
        self,
        num_loans: int = 100,
        observation_months: int = 24,
        start_date: str = "2022-01-01",
    ) -> LoanPerformanceTape:
        """Generates longitudinal monthly performance records for a cohort of loans."""
        start = date.fromisoformat(start_date).replace(day=1)
        records = []
        tot_orig_upb = 0.0

        for l_idx in range(1, num_loans + 1):
            loan_id = f"LN_{l_idx:06d}"
            orig_upb = float(self.rng.choice([15000, 25000, 40000, 150000, 300000]))
            tot_orig_upb += orig_upb
            
            interest_rate = float(round(self.rng.uniform(4.5, 12.5), 2))
            orig_term = int(self.rng.choice([36, 60, 360]))
            
            # Monthly principal & interest payment calculation
            r_m = (interest_rate / 100.0) / 12.0
            monthly_pmt = orig_upb * (r_m * (1 + r_m)**orig_term) / ((1 + r_m)**orig_term - 1)
            
            curr_state = 0  # Start as Current
            curr_upb = orig_upb
            cum_recoveries = 0.0

            for m in range(observation_months):
                curr_month_date = self._add_months(start, m)

                # Absorbing state check (Prepaid or Defaulted in previous month)
                if curr_state in (5, 6):
                    # Loan right-censored / terminal
                    continue

                # Transition state according to Markov matrix
                probs = self.MARKOV_TRANSITION_MATRIX[curr_state]
                curr_state = int(self.rng.choice(7, p=probs))

                # Amortization update
                if curr_state == 6:
                    # Prepaid
                    actual_principal = curr_upb
                    curr_upb = 0.0
                    zero_code = "01"
                elif curr_state == 5:
                    # Default / Charge-off
                    actual_principal = 0.0
                    cum_recoveries = curr_upb * 0.35  # 35% LGD workout recovery
                    zero_code = "03"
                    curr_upb = 0.0
                else:
                    interest_pmt = curr_upb * r_m
                    sched_principal = monthly_pmt - interest_pmt
                    actual_principal = min(curr_upb, sched_principal)
                    curr_upb = max(0.0, curr_upb - actual_principal)
                    zero_code = None

                rec = MonthlyLoanPerformanceRecord(
                    loan_id=loan_id,
                    tenant_id=self.tenant_id,
                    as_of_date=curr_month_date,
                    reporting_period=curr_month_date.strftime("%Y-%m"),
                    loan_age_months=m + 1,
                    remaining_months_to_maturity=max(0, orig_term - (m + 1)),
                    current_interest_rate=interest_rate,
                    current_actual_upb=round(curr_upb, 2),
                    scheduled_principal_payment=round(monthly_pmt, 2),
                    actual_principal_payment=round(actual_principal, 2),
                    delinquency_status=self.STATE_TO_ENUM[curr_state],
                    zero_balance_code=zero_code,
                    zero_balance_effective_date=curr_month_date if zero_code else None,
                    cumulative_cash_recoveries=round(cum_recoveries, 2),
                    estimated_drawn_at_default_ead=round(orig_upb, 2) if curr_state == 5 else None,
                )
                records.append(rec)

        return LoanPerformanceTape(
            tape_id=f"TAPE_MARKOV_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            tenant_id=self.tenant_id,
            portfolio_name="Longitudinal_Markov_Panel",
            as_of_date=datetime.utcnow(),
            records=records,
            total_loans=num_loans,
            total_original_upb=round(tot_orig_upb, 2),
        )

    def _add_months(self, sourcedate: date, months: int) -> date:
        month = sourcedate.month - 1 + months
        year = sourcedate.year + month // 12
        month = month % 12 + 1
        return date(year, month, 1)
