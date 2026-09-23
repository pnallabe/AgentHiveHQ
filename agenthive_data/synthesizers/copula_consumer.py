"""
Gaussian Copula Synthetic Consumer Credit Generator.
Generates realistic multi-variate correlated consumer profiles preserving empirical correlation structures
between FICO score, Debt-To-Income (DTI), Revolving Utilization, Annual Income, and Credit Inquiries.
"""

from datetime import datetime, date
import math
from typing import List, Dict, Any, Optional
import numpy as np
try:
    from scipy.stats import norm
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

from agenthive_data.schemas.application import ConsumerApplication, ApplicationType
from agenthive_data.schemas.bureau import BureauReport, BureauSource, Tradeline, TradelineAccountType, AccountStatus


class GaussianCopulaConsumerSynthesizer:
    """Gaussian Copula generator preserving empirical correlation matrices across credit metrics."""

    DEFAULT_CORRELATION_MATRIX = np.array([
        # FICO,  DTI,   UTIL,   INCOME, INQUIRIES
        [ 1.00, -0.42, -0.58,   0.35,  -0.31],  # FICO
        [-0.42,  1.00,  0.48,  -0.25,   0.20],  # DTI
        [-0.58,  0.48,  1.00,  -0.18,   0.28],  # UTIL
        [ 0.35, -0.25, -0.18,   1.00,  -0.08],  # INCOME
        [-0.31,  0.20,  0.28,  -0.08,   1.00],  # INQUIRIES
    ])

    def __init__(self, tenant_id: str = "tenant_default", seed: Optional[int] = 42):
        self.tenant_id = tenant_id
        self.rng = np.random.default_rng(seed)

    def _erf_inv(self, y: np.ndarray) -> np.ndarray:
        """Approximation of inverse error function if scipy norm.ppf unavailable."""
        # Winitzki approximation for erf_inv
        a = 0.147
        log_term = np.log(1.0 - y**2)
        term1 = 2.0 / (np.pi * a) + log_term / 2.0
        inner = term1**2 - log_term / a
        sign = np.sign(y)
        return sign * np.sqrt(np.sqrt(inner) - term1)

    def _norm_cdf(self, x: np.ndarray) -> np.ndarray:
        if SCIPY_AVAILABLE:
            return norm.cdf(x)
        return 0.5 * (1.0 + np.vectorize(math.erf)(x / np.sqrt(2.0)))

    def _norm_ppf(self, q: np.ndarray) -> np.ndarray:
        if SCIPY_AVAILABLE:
            return norm.ppf(q)
        # Convert quantile q in (0,1) to y in (-1,1) for erf_inv
        q_clamped = np.clip(q, 1e-7, 1.0 - 1e-7)
        y = 2.0 * q_clamped - 1.0
        return np.sqrt(2.0) * self._erf_inv(y)

    def generate_batch(self, count: int = 100) -> List[Dict[str, Any]]:
        """Generates a batch of correlated (Application, BureauReport) pairs."""
        # 1. Cholesky decomposition of target correlation matrix
        cov = self.DEFAULT_CORRELATION_MATRIX
        L = np.linalg.cholesky(cov)

        # 2. Draw uncorrelated standard normal variables
        Z = self.rng.standard_normal((count, 5))

        # 3. Induce correlation structure: X = Z * L^T
        X_corr = Z @ L.T

        # 4. Map to Uniform(0,1) quantiles via standard normal CDF
        U = self._norm_cdf(X_corr)

        pairs = []
        for i in range(count):
            u_fico, u_dti, u_util, u_inc, u_inq = U[i]

            # Marginal distributions
            fico = int(np.clip(300 + u_fico * 550, 300, 850))
            dti_pct = float(np.clip(u_dti * 65.0, 5.0, 65.0))
            util_pct = float(np.clip(u_util * 100.0, 0.0, 100.0))
            # Log-normal distribution for income
            income = float(np.clip(np.exp(9.5 + u_inc * 1.5), 18000.0, 350000.0))
            inquiries = int(np.clip(u_inq * 8.0, 0, 12))

            app_id = f"APP_CONS_{i+1:06d}"
            cust_id = f"CUST_{i+1:06d}"

            # Calculate housing cost from income and DTI
            monthly_income = income / 12.0
            housing_cost = round(monthly_income * (dti_pct / 100.0) * 0.5, 2)
            requested_amt = round(monthly_income * 3.5, -2)

            now = datetime.utcnow()
            app = ConsumerApplication(
                application_id=app_id,
                tenant_id=self.tenant_id,
                as_of_date=now,
                application_type=ApplicationType.CONSUMER_UNSECURED,
                applicant_id=cust_id,
                first_name=f"Applicant_{i+1}",
                last_name="TestUser",
                ssn_last4=f"{(1000 + i) % 10000:04d}",
                zip_code="10001",
                state="NY",
                annual_income=round(income, 2),
                housing_cost_monthly=housing_cost,
                employment_status="employed",
                employment_length_years=float(min(30, max(1, int(i % 15)))),
                requested_amount=max(2000.0, requested_amt),
                requested_term_months=36,
                stated_fico_score=fico,
            )

            # Build matching bureau report
            tot_limit = max(1000.0, income * 0.35)
            tot_bal = tot_limit * (util_pct / 100.0)

            bureau = BureauReport(
                bureau_report_id=f"BUR_{app_id}",
                tenant_id=self.tenant_id,
                applicant_id=cust_id,
                as_of_date=now,
                bureau_source=BureauSource.EXPERIAN,
                fico_score=fico,
                revolving_utilization_rate=round(util_pct, 2),
                total_revolving_credit_limit=round(tot_limit, 2),
                total_revolving_balance=round(tot_bal, 2),
                total_monthly_debt_service=round(monthly_income * (dti_pct / 100.0), 2),
                total_inquiries_last_6m=inquiries,
                total_inquiries_last_12m=inquiries + 1,
                tradelines=[
                    Tradeline(
                        tradeline_id=f"TL_{app_id}_1",
                        account_type=TradelineAccountType.REVOLVING,
                        creditor_name="Major Bank Card",
                        opened_date=date(2018, 5, 12),
                        credit_limit_or_orig_bal=round(tot_limit, 2),
                        current_balance=round(tot_bal, 2),
                        monthly_payment=round(tot_bal * 0.03, 2),
                        status=AccountStatus.CURRENT if fico > 620 else AccountStatus.PAST_DUE_30,
                        revolving_utilization_pct=round(util_pct, 2),
                    )
                ]
            )

            pairs.append({"application": app, "bureau": bureau})

        return pairs
