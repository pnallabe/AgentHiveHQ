"""Generate a fictional-client bulk application CSV for the 100k demo.

Produces a realistic portfolio of applications in the exact schema the batch
endpoint accepts, so a prospect can watch 100,000 decisions flow through the
live pipeline and then see the exam package generated from them.

Usage:
    python -m backend.scripts.generate_fictional_client \
        --out backend/data/demo_client_100k.csv --n 100000

The generator reuses the same distributions as the model's training data
(data_generator.py) so the resulting approval rate and segment mix look like a
real mid-market lender's book (~65–70% approval, ~30% thin-file).
"""
from __future__ import annotations

import argparse
import csv
import sys

import numpy as np


def generate_rows(n: int, seed: int = 7) -> list[dict]:
    rng = np.random.default_rng(seed)

    # Income: log-normal centred ~$68k
    incomes = np.clip(
        rng.lognormal(mean=np.log(68_000), sigma=0.55, size=n), 12_000, 600_000
    ).round(0)

    # Employment length: gamma, 0–40 yrs
    employment = np.clip(rng.gamma(shape=2.0, scale=3.2, size=n), 0, 40).round(1)

    # Housing
    housing = rng.choice(["own", "mortgage", "rent"], size=n, p=[0.22, 0.36, 0.42])

    # Credit score: 30% thin-file (blank), rest beta-scaled 500–850
    thin_mask = rng.random(n) < 0.30
    scores = np.clip((rng.beta(5, 2, n) * 350 + 500).round(0), 500, 850).astype(int)

    rows = []
    for i in range(n):
        rows.append(
            {
                "applicant_ref": f"APP-{i + 1:07d}",
                "income": int(incomes[i]),
                "employment_length": float(employment[i]),
                "housing_status": housing[i],
                # Blank for thin-file applicants — the whole point of the demo.
                "credit_score": "" if thin_mask[i] else int(scores[i]),
            }
        )
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate fictional-client bulk CSV")
    ap.add_argument("--out", required=True, help="Output CSV path")
    ap.add_argument("--n", type=int, default=100_000, help="Number of applications")
    ap.add_argument("--seed", type=int, default=7, help="Random seed")
    args = ap.parse_args()

    rows = generate_rows(args.n, args.seed)
    fieldnames = ["applicant_ref", "income", "employment_length", "housing_status", "credit_score"]

    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    thin = sum(1 for r in rows if r["credit_score"] == "")
    print(f"Wrote {len(rows):,} applications to {args.out}", file=sys.stderr)
    print(f"  thin-file (no credit score): {thin:,} ({thin / len(rows):.0%})", file=sys.stderr)


if __name__ == "__main__":
    main()
