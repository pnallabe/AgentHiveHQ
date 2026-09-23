"""
Open Banking & Plaid JSON Webhook Parser.
Normalizes transactions, balances, and detects high-frequency MCA debt stacking.
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List
from agenthive_data.schemas.banking import OpenBankingFeed, BankTransaction, AccountBalance, TransactionCategory


class OpenBankingParser:
    """Parser & normalizer for Plaid / Yodlee Open Banking JSON webhooks."""

    MCA_KEYWORDS = ["kabbage", "ondeck", "can capital", "fundbox", "liberty capital", "mca advance", "dailyach", "forward financing"]

    def __init__(self, tenant_id: str = "tenant_default"):
        self.tenant_id = tenant_id

    def parse_plaid_webhook_payload(self, payload: Dict[str, Any], customer_id: str) -> OpenBankingFeed:
        """Converts raw Plaid JSON payload into validated OpenBankingFeed."""
        raw_accounts = payload.get("accounts", [])
        raw_transactions = payload.get("transactions", [])
        
        accounts = []
        for acc in raw_accounts:
            accounts.append(AccountBalance(
                account_id=acc.get("account_id", "acc_1"),
                account_type=acc.get("type", "depository"),
                current_balance=float(acc.get("balances", {}).get("current", 0.0)),
                available_balance=float(acc.get("balances", {}).get("available", 0.0)) if acc.get("balances", {}).get("available") else None,
                currency=acc.get("balances", {}).get("iso_currency_code", "USD"),
            ))

        transactions = []
        nsf_count = 0
        mca_detected = False
        total_inflows = 0.0
        total_outflows = 0.0

        for tx in raw_transactions:
            amt = float(tx.get("amount", 0.0))
            desc = tx.get("name", "") + " " + tx.get("merchant_name", "")
            desc_lower = desc.lower()

            category = TransactionCategory.OTHER
            if amt < 0:
                total_inflows += abs(amt)
                category = TransactionCategory.INCOME_PAYROLL
            else:
                total_outflows += amt

            if "nsf" in desc_lower or "overdraft" in desc_lower:
                nsf_count += 1
                category = TransactionCategory.NSF_FEE

            if any(k in desc_lower for k in self.MCA_KEYWORDS):
                mca_detected = True
                category = TransactionCategory.DEBT_STACKING_MCA

            tx_date_str = tx.get("date", date.today().isoformat())

            transactions.append(BankTransaction(
                transaction_id=tx.get("transaction_id", f"tx_{len(transactions)+1}"),
                account_id=tx.get("account_id", "acc_1"),
                tenant_id=self.tenant_id,
                as_of_date=datetime.utcnow(),
                transaction_date=date.fromisoformat(tx_date_str),
                amount=amt,
                description=desc,
                category=category,
                merchant_name=tx.get("merchant_name"),
                is_pending=tx.get("pending", False),
            ))

        return OpenBankingFeed(
            feed_id=f"FEED_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            tenant_id=self.tenant_id,
            customer_id=customer_id,
            institution_id=payload.get("item", {}).get("institution_id", "ins_1"),
            institution_name="Plaid Connected Bank",
            as_of_date=datetime.utcnow(),
            accounts=accounts,
            transactions=transactions,
            avg_monthly_inflow_90d=round(total_inflows / 3.0, 2),
            avg_monthly_outflow_90d=round(total_outflows / 3.0, 2),
            nsf_overdraft_count_90d=nsf_count,
            mca_debt_stacking_detected=mca_detected,
        )
