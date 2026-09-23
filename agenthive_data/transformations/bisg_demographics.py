"""
Bayesian Improved Surname Geocoding (BISG) Demographic Proxy Engine.
Calculates posterior probabilities for race/ethnicity (White, Black, Hispanic, API, AIAN, Multiracial)
combining US Census surname probability tables and census tract FIPS demographics.
"""

from typing import Dict, Any, Optional
import numpy as np


class BISGDemographicProxyEngine:
    """BISG Proxy Matching Engine combining Census Surname Matrix and Tract Demographics."""

    ETHNICITY_KEYS = ["white", "black", "hispanic", "api", "aian", "multiracial"]

    # Calibrated Census Surname Probabilities (Fallback Dictionary for Common Surnames)
    CENSUS_SURNAME_PRIORS = {
        "SMITH": {"white": 0.70, "black": 0.23, "hispanic": 0.02, "api": 0.01, "aian": 0.01, "multiracial": 0.03},
        "RODRIGUEZ": {"white": 0.05, "black": 0.01, "hispanic": 0.92, "api": 0.01, "aian": 0.00, "multiracial": 0.01},
        "WASHINGTON": {"white": 0.05, "black": 0.88, "hispanic": 0.02, "api": 0.01, "aian": 0.01, "multiracial": 0.03},
        "WANG": {"white": 0.02, "black": 0.01, "hispanic": 0.01, "api": 0.94, "aian": 0.00, "multiracial": 0.02},
        "DEFAULT": {"white": 0.60, "black": 0.13, "hispanic": 0.18, "api": 0.06, "aian": 0.01, "multiracial": 0.02},
    }

    # Census Tract FIPS Demographics (Sample Tract FIPS 36061000100 - NYC)
    DEFAULT_TRACT_GEO_PRIORS = {
        "white": 0.55,
        "black": 0.15,
        "hispanic": 0.18,
        "api": 0.08,
        "aian": 0.01,
        "multiracial": 0.03,
    }

    def predict_bisg_probabilities(
        self,
        surname: str,
        fips_tract: Optional[str] = None,
        geo_demographics: Optional[Dict[str, float]] = None,
    ) -> Dict[str, float]:
        """Computes Bayesian posterior probability distribution P(Race | Surname, Geography).

        Formula:
        P(Race_k | Surname, Geo) = [ P(Surname | Race_k) * P(Geo | Race_k) ] / Sum_j [ P(Surname | Race_j) * P(Geo | Race_j) ]
        """
        clean_surname = surname.strip().upper() if surname else "DEFAULT"
        s_prob = self.CENSUS_SURNAME_PRIORS.get(clean_surname, self.CENSUS_SURNAME_PRIORS["DEFAULT"])
        g_prob = geo_demographics or self.DEFAULT_TRACT_GEO_PRIORS

        unnormalized_posteriors = {}
        for k in self.ETHNICITY_KEYS:
            p_s = s_prob.get(k, 0.01)
            p_g = g_prob.get(k, 0.01)
            unnormalized_posteriors[k] = p_s * p_g

        total = sum(unnormalized_posteriors.values())
        if total == 0:
            total = 1.0

        posteriors = {k: round(v / total, 4) for k, v in unnormalized_posteriors.items()}
        return posteriors
