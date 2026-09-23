"""
Master Data Ingestion & Pipeline Runner Script.
Extracts, synthesizes, cleans, transforms, and materializes test datasets across all Medallion layers (Bronze, Silver, Gold),
DuckDB Analytical Warehouse, and Low-Latency Dual-Layer Feature Store.
"""

from datetime import datetime, date
import logging
import json
from pathlib import Path
import pandas as pd

from agenthive_data.config import config
from agenthive_data.extractors.fred_connector import FREDConnector
from agenthive_data.extractors.sec_edgar_abs import SECEdgarABSParser
from agenthive_data.extractors.tax_document_parser import TaxDocumentParser
from agenthive_data.extractors.open_banking_parser import OpenBankingParser
from agenthive_data.synthesizers.copula_consumer import GaussianCopulaConsumerSynthesizer
from agenthive_data.synthesizers.commercial_cashflow import CommercialCashFlowSynthesizer
from agenthive_data.synthesizers.longitudinal_tape import LongitudinalPerformanceTapeSynthesizer
from agenthive_data.synthesizers.fraud_stream import RealtimeFraudStreamSynthesizer
from agenthive_data.transformations.silver_cleaners import SilverCleaners
from agenthive_data.transformations.gold_features import GoldFeatureExtractor
from agenthive_data.transformations.bisg_demographics import BISGDemographicProxyEngine
from agenthive_data.storage.warehouse import AnalyticalWarehouse
from agenthive_data.storage.feature_store import DualLayerFeatureStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("agenthive_data.ingest")


def run_data_ingestion_pipeline(tenant_id: str = "tenant_demo", sample_size: int = 100) -> dict:
    """Executes end-to-end Medallion data ingestion, transformation, and feature store hydration."""
    logger.info(f"=== Starting AgentHive Data Ingestion Pipeline for Tenant: {tenant_id} ===")
    
    # Initialize components
    warehouse = AnalyticalWarehouse()
    feature_store = DualLayerFeatureStore(tenant_id=tenant_id)
    gold_extractor = GoldFeatureExtractor(tenant_id=tenant_id)
    bisg_engine = BISGDemographicProxyEngine()

    summary_stats = {
        "tenant_id": tenant_id,
        "executed_at": datetime.utcnow().isoformat(),
        "counts": {},
        "paths": {}
    }

    # ---------------------------------------------------------
    # 1. Macroeconomic Data Ingestion (Domain D)
    # ---------------------------------------------------------
    logger.info("1. Ingesting FRED Macroeconomic & Yield Curve Series...")
    fred = FREDConnector()
    sofr_series = fred.fetch_series("SOFR", start_date="2022-01-01")
    unrate_series = fred.fetch_series("UNRATE", start_date="2022-01-01")
    yield_curve = fred.get_latest_yield_curve()

    macro_df = pd.DataFrame([s.model_dump() for s in sofr_series + unrate_series])
    macro_parquet = config.BRONZE_DIR / "macro_series.parquet"
    macro_df.to_parquet(macro_parquet, index=False)
    summary_stats["counts"]["macro_series_points"] = len(macro_df)
    summary_stats["paths"]["macro_bronze"] = str(macro_parquet)

    # ---------------------------------------------------------
    # 2. Consumer Retail Origination (Domain A)
    # ---------------------------------------------------------
    logger.info(f"2. Synthesizing {sample_size} Consumer Applications & Tri-Merge Bureau Reports via Gaussian Copula...")
    copula_synth = GaussianCopulaConsumerSynthesizer(tenant_id=tenant_id, seed=42)
    consumer_pairs = copula_synth.generate_batch(count=sample_size)

    raw_apps = [p["application"].model_dump() for p in consumer_pairs]
    raw_bureaus = [p["bureau"].model_dump() for p in consumer_pairs]

    # Save Bronze Raw Payloads
    apps_bronze_path = config.BRONZE_DIR / f"consumer_applications_{tenant_id}.json"
    with open(apps_bronze_path, "w") as f:
        json.dump(raw_apps, f, default=str, indent=2)

    # Clean to Silver
    silver_apps_df = SilverCleaners.clean_consumer_applications(raw_apps)
    silver_bureau_df = SilverCleaners.clean_bureau_reports(raw_bureaus)

    silver_apps_parquet = config.SILVER_DIR / f"silver_applications_{tenant_id}.parquet"
    silver_apps_df.to_parquet(silver_apps_parquet, index=False)

    # Transform to Gold Point-in-Time Features
    as_of_now = datetime.utcnow()
    gold_features_df = gold_extractor.extract_consumer_underwriting_features(
        application_df=silver_apps_df,
        bureau_df=silver_bureau_df,
        as_of_cutoff=as_of_now,
    )

    # Apply BISG Demographic Proxies
    bisg_results = []
    for _, row in gold_features_df.iterrows():
        surname = str(row.get("last_name", "SMITH"))
        bisg_probs = bisg_engine.predict_bisg_probabilities(surname=surname)
        bisg_results.append(bisg_probs)

    bisg_df = pd.DataFrame(bisg_results)
    gold_features_df = pd.concat([gold_features_df.reset_index(drop=True), bisg_df.reset_index(drop=True)], axis=1)

    gold_parquet = config.GOLD_DIR / f"gold_consumer_features_{tenant_id}.parquet"
    gold_features_df.to_parquet(gold_parquet, index=False)

    # Materialize to Online Low-Latency Feature Store
    feature_store.materialize_online(gold_features_df, entity_col="applicant_id")

    summary_stats["counts"]["consumer_applications"] = len(silver_apps_df)
    summary_stats["counts"]["gold_consumer_features"] = len(gold_features_df)
    summary_stats["paths"]["gold_consumer_features"] = str(gold_parquet)

    # ---------------------------------------------------------
    # 3. Commercial & Small Business (SMB) Ingestion (Domain B)
    # ---------------------------------------------------------
    logger.info("3. Ingesting Commercial Tax Filings & Synthesizing Daily ACH Cash Flows...")
    tax_parser = TaxDocumentParser(tenant_id=tenant_id)
    tax_1120s = tax_parser.parse_form_1120s_text(
        text_content="1a Gross receipts or sales 2,500,000\n2 Cost of goods sold 1,100,000",
        business_id="BUS_COMM_88",
        tax_year=2023,
    )

    comm_synth = CommercialCashFlowSynthesizer(tenant_id=tenant_id, seed=101)
    open_banking_feed = comm_synth.generate_daily_feed(
        business_id="BUS_COMM_88",
        num_days=90,
        avg_daily_revenue=7500.0,
        inject_mca_stacking=True,
        mca_lender_count=2,
    )

    summary_stats["counts"]["commercial_ach_transactions"] = len(open_banking_feed.transactions)
    summary_stats["counts"]["mca_stacking_detected"] = open_banking_feed.mca_debt_stacking_detected

    # ---------------------------------------------------------
    # 4. Longitudinal Performance Tapes (Domain C - CECL / ABS-EE)
    # ---------------------------------------------------------
    logger.info("4. Generating Longitudinal Loan Performance Panels & SEC ABS-EE Tapes...")
    abs_parser = SECEdgarABSParser(tenant_id=tenant_id)
    abs_tape = abs_parser.generate_mock_absee_tape(num_loans=50)

    long_synth = LongitudinalPerformanceTapeSynthesizer(tenant_id=tenant_id, seed=99)
    long_tape = long_synth.generate_loan_panel(num_loans=50, observation_months=24)

    long_records_df = pd.DataFrame([r.model_dump() for r in long_tape.records])
    long_parquet = config.GOLD_DIR / f"longitudinal_panel_{tenant_id}.parquet"
    long_records_df.to_parquet(long_parquet, index=False)

    summary_stats["counts"]["longitudinal_monthly_records"] = len(long_records_df)
    summary_stats["paths"]["longitudinal_panel"] = str(long_parquet)

    # ---------------------------------------------------------
    # 5. Financial Crimes & Realtime Fraud Streams (Domain E)
    # ---------------------------------------------------------
    logger.info("5. Synthesizing Real-time Fraud Stream Events & Mule Ring Graphs...")
    fraud_synth = RealtimeFraudStreamSynthesizer(tenant_id=tenant_id, seed=77)
    fraud_events = fraud_synth.generate_transaction_stream(count=50, inject_app_scam_pct=0.12)
    mule_edges = fraud_synth.generate_mule_ring_graph(ring_size=5)

    summary_stats["counts"]["realtime_fraud_events"] = len(fraud_events)
    summary_stats["counts"]["mule_ring_edges"] = len(mule_edges)

    # ---------------------------------------------------------
    # 6. Verify DuckDB Analytical Warehouse Query Execution
    # ---------------------------------------------------------
    logger.info("6. Verifying DuckDB Analytical Query Execution over Gold Parquet Store...")
    duckdb_df = warehouse.query_parquet(
        parquet_path=gold_parquet,
        sql_query="SELECT COUNT(*) as total_loans, AVG(gold_feat_fico_score) as avg_fico FROM read_parquet('{parquet_file}')"
    )
    summary_stats["duckdb_verification"] = duckdb_df.to_dict(orient="records")

    logger.info("=== Data Ingestion Pipeline Completed Successfully ===")
    return summary_stats


if __name__ == "__main__":
    stats = run_data_ingestion_pipeline()
    print(json.dumps(stats, indent=2))
