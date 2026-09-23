"""
Dual-Layer Feature Store Module.
Provides low-latency (<15ms) online feature serving and point-in-time offline feature retrieval.
"""

from datetime import datetime, date
import hashlib
import json
from typing import Dict, Any, Optional, List
import pandas as pd

from agenthive_data.config import config
from agenthive_data.storage.warehouse import AnalyticalWarehouse
from agenthive_data.transformations.gold_features import GoldFeatureExtractor


class DualLayerFeatureStore:
    """Unified Feature Store containing Online Cache (<15ms) and Offline Analytical Parquet Store."""

    def __init__(self, tenant_id: str = "tenant_default"):
        self.tenant_id = tenant_id
        self.warehouse = AnalyticalWarehouse()
        self.gold_extractor = GoldFeatureExtractor(tenant_id=tenant_id)
        
        # Online In-Memory Cache: { entity_key -> { feature_name: value, timestamp: dt } }
        self._online_cache: Dict[str, Dict[str, Any]] = {}

    def get_online_features(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Low-latency (<15ms) online feature lookup for live decision engines and fraud scorers."""
        cache_key = f"{self.tenant_id}:{entity_id}"
        record = self._online_cache.get(cache_key)
        if not record:
            return None
        return record.get("features")

    def set_online_features(self, entity_id: str, features: Dict[str, Any]):
        """Pushes feature vector into the online cache."""
        cache_key = f"{self.tenant_id}:{entity_id}"
        # Compute SHA-256 hash for feature vector integrity verification
        vec_json = json.dumps(features, sort_keys=True, default=str)
        vec_hash = hashlib.sha256(vec_json.encode()).hexdigest()
        
        self._online_cache[cache_key] = {
            "entity_id": entity_id,
            "tenant_id": self.tenant_id,
            "updated_at": datetime.utcnow().isoformat(),
            "hash": vec_hash,
            "features": features,
        }

    def materialize_online(self, offline_df: pd.DataFrame, entity_col: str = "applicant_id"):
        """Hydrates/materializes batch offline features into the low-latency online cache."""
        if offline_df.empty:
            return

        for _, row in offline_df.iterrows():
            entity_id = str(row[entity_col])
            feats = row.to_dict()
            self.set_online_features(entity_id, feats)

    def get_offline_features_as_of(
        self,
        application_df: pd.DataFrame,
        bureau_df: pd.DataFrame,
        as_of_cutoff: datetime,
    ) -> pd.DataFrame:
        """Retrieves point-in-time offline feature matrix cut off strictly at as_of_cutoff."""
        return self.gold_extractor.extract_consumer_underwriting_features(
            application_df=application_df,
            bureau_df=bureau_df,
            as_of_cutoff=as_of_cutoff,
        )
