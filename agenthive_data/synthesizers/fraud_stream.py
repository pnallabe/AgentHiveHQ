"""
Real-Time Transaction & Mule Account Graph Synthesizer.
Generates streaming transaction payloads with device telemetry, IP subnets, APP scam anomalies, and money mule rings.
"""

from datetime import datetime, timedelta
import random
from typing import List, Dict, Any, Optional
from agenthive_data.schemas.fraud import (
    RealtimeTransactionEvent,
    DeviceTelemetry,
    MuleAccountGraphEdge,
    TransactionChannel,
    FraudRiskLevel,
)


class RealtimeFraudStreamSynthesizer:
    """Stream synthesizer for financial crime detection, APP scams, and mule ring graphs."""

    def __init__(self, tenant_id: str = "tenant_default", seed: Optional[int] = 42):
        self.tenant_id = tenant_id
        if seed is not None:
            random.seed(seed)

    def generate_transaction_stream(
        self,
        count: int = 50,
        inject_app_scam_pct: float = 0.10,
    ) -> List[RealtimeTransactionEvent]:
        """Generates real-time transaction events with device telemetry and fraud scoring."""
        events = []
        now = datetime.utcnow()

        subnets = ["192.168.1.", "10.0.4.", "172.16.22.", "45.33.12."]
        channels = [TransactionChannel.MOBILE_APP, TransactionChannel.WEB_BROWSER, TransactionChannel.WIRE]

        for i in range(1, count + 1):
            is_scam = random.random() < inject_app_scam_pct
            cust_id = f"CUST_FRD_{i:04d}"
            account_id = f"ACC_FRD_{i:04d}"

            # High velocity & amount for scam anomalies
            amount = round(random.uniform(4500.0, 25000.0), 2) if is_scam else round(random.uniform(15.0, 450.0), 2)
            velocity_1h = random.randint(4, 12) if is_scam else random.randint(1, 2)
            is_vpn = True if is_scam else (random.random() < 0.05)

            telemetry = DeviceTelemetry(
                device_hash=f"DEV_HASH_{i:05d}" if not is_scam else "DEV_HASH_VPN_PROXY_99",
                ip_address=f"{random.choice(subnets)}{random.randint(1, 254)}",
                ip_subnet_fips="36061",  # NYC FIPS
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X)",
                is_vpn_or_proxy=is_vpn,
                is_emulator=is_scam,
                location_lat=40.7128 + random.uniform(-0.05, 0.05),
                location_lon=-74.0060 + random.uniform(-0.05, 0.05),
            )

            risk_score = round(min(99.9, max(1.0, (amount / 250.0) + (velocity_1h * 8.5) + (40.0 if is_vpn else 0.0))), 1)

            ev = RealtimeTransactionEvent(
                event_id=f"EVT_{now.strftime('%Y%m%d%H%M%S')}_{i:04d}",
                tenant_id=self.tenant_id,
                account_id=account_id,
                customer_id=cust_id,
                as_of_date=now - timedelta(seconds=count - i),
                amount=amount,
                currency="USD",
                channel=random.choice(channels),
                payee_account_id=f"PAYEE_{random.randint(100, 999)}",
                payee_routing_number="021000021",
                telemetry=telemetry,
                velocity_1h_count=velocity_1h,
                velocity_24h_amount=round(amount * 1.5, 2),
                is_first_time_payee=is_scam or (random.random() < 0.20),
                fraud_risk_score=risk_score,
                app_scam_probability=round(0.85 if is_scam else 0.02, 2),
            )
            events.append(ev)

        return events

    def generate_mule_ring_graph(self, ring_size: int = 5) -> List[MuleAccountGraphEdge]:
        """Generates graph edge representations of rapid funnel money mule account rings."""
        edges = []
        now = datetime.utcnow()
        mule_nodes = [f"ACC_MULE_{idx:03d}" for idx in range(1, ring_size + 1)]

        for i in range(len(mule_nodes) - 1):
            src = mule_nodes[i]
            tgt = mule_nodes[i + 1]
            edges.append(MuleAccountGraphEdge(
                source_account_id=src,
                target_account_id=tgt,
                tenant_id=self.tenant_id,
                first_transfer_timestamp=now - timedelta(minutes=45),
                last_transfer_timestamp=now - timedelta(minutes=5),
                total_transfer_volume=48500.0,
                transfer_count=6,
                is_rapid_funnel=True,
            ))
        return edges
