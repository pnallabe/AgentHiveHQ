"""Initial database schema.

Creates the ``decisions`` and ``audit_logs`` tables.
Revision: 0001_initial_schema
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("applicant_ref", sa.String(128), nullable=True),
        sa.Column("input_payload", sa.JSON(), nullable=False),
        sa.Column("decision", sa.String(16), nullable=False),
        sa.Column("credit_limit", sa.Numeric(12, 2), nullable=True),
        sa.Column("apr", sa.Numeric(5, 2), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 4), nullable=True),
        sa.Column("risk_segment", sa.String(32), nullable=True),
        sa.Column("reason_codes", sa.JSON(), nullable=False),
        sa.Column("shap_values", sa.JSON(), nullable=True),
        sa.Column("model_version", sa.String(32), nullable=False),
        sa.Column("rules_triggered", sa.JSON(), nullable=False),
        sa.Column("demo_mode", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.create_index("ix_decisions_created_at", "decisions", ["created_at"])
    op.create_index("ix_decisions_decision", "decisions", ["decision"])
    op.create_index("ix_decisions_demo_mode", "decisions", ["demo_mode"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "decision_id",
            sa.String(36),
            sa.ForeignKey("decisions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(128), nullable=False, server_default="system"),
        sa.Column("metadata", sa.JSON(), nullable=False),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_decision_id", "audit_logs", ["decision_id"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("decisions")
