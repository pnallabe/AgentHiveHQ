"""
Commercial Business Cash-Flow Synthesizer with MCA Debt Stacking Injection.
Generates daily ACH transactions, revenue seasonality, and high-frequency MCA daily debit streams.
"""

from datetime import date, datetime, timedelta
import random
from typing import List, Dict, Any, Optional
from agenthive_data.schemas.banking import BankTransaction, TransactionCategory, AccountBalance, OpenBankingFeed


class CommercialCashFlowSynthesizer:
    """Synthesizer for commercial bank statements and daily ACH cash flows."""

    def __init__(self, tenant_id: str = "tenant_default", seed: Optional[int] = 42):
        self.tenant_id = tenant_id
        self.seed = seed
        if seed is not None:
            random.seed(seed)

    def generate_daily_feed(
        self,
        business_id: str,
        num_days: int = 90,
        avg_daily_revenue: float = 5000.0,
        inject_mca_stacking: bool = False,
        mca_lender_count: int = 2,
    ) -> OpenBankingFeed:
        """Generates 90-day daily bank transactions with optional MCA debt stacking injection."""
        today = date.today()
        start_date = today - timedelta(days=num_days)
        
        transactions = []
        account_id = f"ACC_COMM_{business_id}"
        
        running_balance = 45000.0
        total_inflows = 0.0
        total_outflows = 0.0
        nsf_count = 0

        mca_lenders = ["OnDeck Capital", "Kabbage Direct", "Forward Financing", "Can Capital"]

        for d in range(num_days):
            curr_date = start_date + timedelta(days=d)
            is_weekend = curr_date.weekday() >= 5

            if not is_weekend:
                # 1. Customer Revenue Inflow (ACH/Credit Card Batch)
                daily_rev = max(500.0, random.gauss(avg_daily_revenue, avg_daily_revenue * 0.35))
                running_balance += daily_rev
                total_inflows += daily_rev
                
                transactions.append(BankTransaction(
                    transaction_id=f"TX_REV_{business_id}_{d}",
                    account_id=account_id,
                    tenant_id=self.tenant_id,
                    as_of_date=datetime.combine(curr_date, datetime.min.time()),
                    transaction_date=curr_date,
                    amount=-round(daily_rev, 2),  # Inflow negative in Plaid convention
                    description="STRIPE PAYMENT INT PROCESSING REVENUE",
                    category=TransactionCategory.INCOME_PAYROLL,
                    merchant_name="Stripe Processing",
                ))

                # 2. Operating Expenses Outflow (Suppliers, Payroll, Rent)
                daily_exp = max(200.0, random.gauss(avg_daily_revenue * 0.75, avg_daily_revenue * 0.20))
                running_balance -= daily_exp
                total_outflows += daily_exp
                
                transactions.append(BankTransaction(
                    transaction_id=f"TX_EXP_{business_id}_{d}",
                    account_id=account_id,
                    tenant_id=self.tenant_id,
                    as_of_date=datetime.combine(curr_date, datetime.min.time()),
                    transaction_date=curr_date,
                    amount=round(daily_exp, 2),
                    description="VENDOR SUPPLIES ACH OUTFLOW",
                    category=TransactionCategory.DISCRETIONARY,
                ))

                # 3. Injected MCA Daily Debt Stacking
                if inject_mca_stacking:
                    for m in range(min(mca_lender_count, len(mca_lenders))):
                        mca_debit = 450.0 + (m * 200.0)
                        running_balance -= mca_debit
                        total_outflows += mca_debit

                        # Check NSF risk
                        if running_balance < 0:
                            nsf_count += 1
                            transactions.append(BankTransaction(
                                transaction_id=f"TX_NSF_{business_id}_{d}_{m}",
                                account_id=account_id,
                                tenant_id=self.tenant_id,
                                as_of_date=datetime.combine(curr_date, datetime.min.time()),
                                transaction_date=curr_date,
                                amount=35.0,
                                description="NSF OVERDRAFT FEE - INSUFFICIENT FUNDS",
                                category=TransactionCategory.NSF_FEE,
                            ))

                        transactions.append(BankTransaction(
                            transaction_id=f"TX_MCA_{business_id}_{d}_{m}",
                            account_id=account_id,
                            tenant_id=self.tenant_id,
                            as_of_date=datetime.combine(curr_date, datetime.min.time()),
                            transaction_date=curr_date,
                            amount=round(mca_debit, 2),
                            description=f"DAILY ACH DEBIT {mca_lenders[m].upper()} ADVANCE",
                            category=TransactionCategory.DEBT_STACKING_MCA,
                            merchant_name=mca_lenders[m],
                        ))

        account = AccountBalance(
            account_id=account_id,
            account_type="checking",
            current_balance=round(running_balance, 2),
            available_balance=round(max(0.0, running_balance), 2),
            currency="USD",
        )

        return OpenBankingFeed(
            feed_id=f"FEED_COMM_{business_id}",
            tenant_id=self.tenant_id,
            customer_id=business_id,
            institution_id="ins_commercial_bank",
            institution_name="JPMorgan Chase Commercial",
            as_of_date=datetime.utcnow(),
            accounts=[account],
            transactions=transactions,
            avg_monthly_inflow_90d=round(total_inflows / (num_days / 30.0), 2),
            avg_monthly_outflow_90d=round(total_outflows / (num_days / 30.0), 2),
            nsf_overdraft_count_90d=nsf_count,
            mca_debt_stacking_detected=inject_mca_stacking,
        )
