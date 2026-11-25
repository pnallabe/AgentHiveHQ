"""Tenant model — tenants, memberships, inquiries, tenant_id on decisions/audit_logs.

Revision: 0002_tenant_model

Notes:
- ``tenant_id`` on ``decisions`` / ``audit_logs`` is nullable so existing rows
  (legacy + sandbox demo decisions) remain valid. Backfill is a separate,
  operational step once tenants are provisioned.
- Uses ``batch_alter_table`` so the migration works on both SQLite (dev/test)
  and PostgreSQL (staging/prod).
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False, server_default="pilot"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
    )
    op.create_index("ix_tenants_slug", "tenants", ["slug"], unique=True)
    op.create_index("ix_tenants_status", "tenants", ["status"])

    op.create_table(
        "tenant_memberships",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "tenant_id",
            sa.String(36),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_uid", sa.String(128), nullable=False),
        sa.Column("email", sa.String(256), nullable=True),
        sa.Column("role", sa.String(32), nullable=False, server_default="underwriter"),
    )
    op.create_index("ix_tenant_memberships_tenant_id", "tenant_memberships", ["tenant_id"])
    op.create_index("ix_tenant_memberships_user_uid", "tenant_memberships", ["user_uid"])
    # One membership row per (tenant, user) pair.
    op.create_index(
        "uq_tenant_memberships_tenant_user",
        "tenant_memberships",
        ["tenant_id", "user_uid"],
        unique=True,
    )

    op.create_table(
        "tenant_inquiries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("email", sa.String(256), nullable=False),
        sa.Column("company", sa.String(256), nullable=False),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("use_case", sa.Text(), nullable=False),
        sa.Column("volume", sa.String(32), nullable=True),
        sa.Column("referral", sa.String(256), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="new"),
    )
    op.create_index("ix_tenant_inquiries_created_at", "tenant_inquiries", ["created_at"])
    op.create_index("ix_tenant_inquiries_email", "tenant_inquiries", ["email"])
    op.create_index("ix_tenant_inquiries_status", "tenant_inquiries", ["status"])

    # ── Tenant scope on existing append-only tables ──────────────────────────
    with op.batch_alter_table("decisions") as batch_op:
        batch_op.add_column(sa.Column("tenant_id", sa.String(36), nullable=True))
        batch_op.create_index("ix_decisions_tenant_id", ["tenant_id"])
        batch_op.create_foreign_key(
            "fk_decisions_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.add_column(sa.Column("tenant_id", sa.String(36), nullable=True))
        batch_op.create_index("ix_audit_logs_tenant_id", ["tenant_id"])
        batch_op.create_foreign_key(
            "fk_audit_logs_tenant_id",
            "tenants",
            ["tenant_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.drop_constraint("fk_audit_logs_tenant_id", type_="foreignkey")
        batch_op.drop_index("ix_audit_logs_tenant_id")
        batch_op.drop_column("tenant_id")

    with op.batch_alter_table("decisions") as batch_op:
        batch_op.drop_constraint("fk_decisions_tenant_id", type_="foreignkey")
        batch_op.drop_index("ix_decisions_tenant_id")
        batch_op.drop_column("tenant_id")

    op.drop_table("tenant_inquiries")
    op.drop_table("tenant_memberships")
    op.drop_table("tenants")
