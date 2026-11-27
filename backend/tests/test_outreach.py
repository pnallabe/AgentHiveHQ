"""Tests for the governance-first outreach engine.

Covers: admin auth, CSV import (dupes/suppression), enrollment, dry-run
sequencer gates, unsubscribe round-trip, and open tracking.

Note: the shared in-memory test DB persists committed rows across tests, so
every test uses unique email addresses (via the ``_tag`` helper) to stay
order-independent.
"""
from __future__ import annotations

import io
import uuid

import pytest
from sqlalchemy import select

from app.core.config import settings
from app.modules.outreach.sequencer import (
    make_unsubscribe_token,
    verify_unsubscribe_token,
)
from app.shared.db_models import (
    OutreachEnrollment,
    OutreachMessage,
    OutreachSuppression,
)

ADMIN = {"X-Outreach-Admin-Key": "test-admin-key"}


def _tag() -> str:
    return uuid.uuid4().hex[:8]


def _csv_for(tag: str) -> bytes:
    return (
        "company,email,contact_name,domain,title,segment,aum_band\n"
        f"Acme {tag},jane-{tag}@acme.example,Jane Doe,acme-{tag}.example,CRO,fintech-lender,100m-500m\n"
        f"Beta {tag},bob-{tag}@beta.example,Bob Smith,beta-{tag}.example,Head of Model Risk,fintech-lender,500m-1b\n"
    ).encode()


async def _import(client, csv_bytes: bytes) -> dict:
    files = {"file": ("prospects.csv", io.BytesIO(csv_bytes), "text/csv")}
    res = await client.post("/api/v1/outreach/admin/prospects/import", files=files, headers=ADMIN)
    assert res.status_code == 200
    return res.json()


@pytest.fixture(autouse=True)
def _configure_outreach(monkeypatch):
    """Enable the admin API with a known key; keep sending disabled (dry-run)."""
    monkeypatch.setattr(settings, "OUTREACH_ADMIN_KEY", "test-admin-key")
    monkeypatch.setattr(settings, "OUTREACH_SEND_ENABLED", False)
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret")


# ── Admin auth ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_admin_endpoints_require_key(client):
    res = await client.get("/api/v1/outreach/admin/prospects")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_auth_not_configured_returns_503(client, monkeypatch):
    monkeypatch.setattr(settings, "OUTREACH_ADMIN_KEY", "")
    res = await client.get("/api/v1/outreach/admin/prospects")
    assert res.status_code == 503


# ── Import ────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_import_creates_prospects_and_skips_duplicates(client):
    tag = _tag()
    body = await _import(client, _csv_for(tag))
    assert body["created"] == 2
    assert body["skipped_duplicates"] == 0

    # Re-import — both are duplicates now.
    body = await _import(client, _csv_for(tag))
    assert body["skipped_duplicates"] == 2


@pytest.mark.asyncio
async def test_import_skips_suppressed_emails(client, db_session):
    tag = _tag()
    db_session.add(OutreachSuppression(email=f"jane-{tag}@acme.example", reason="unsubscribe"))
    await db_session.commit()

    body = await _import(client, _csv_for(tag))
    assert body["created"] == 1
    assert body["skipped_suppressed"] == 1


# ── Enroll + dry-run sequencer ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_enroll_and_dry_run_sequencer(client, db_session):
    tag = _tag()
    await _import(client, _csv_for(tag))

    prospects = (await client.get("/api/v1/outreach/admin/prospects", headers=ADMIN)).json()
    ids = [p["id"] for p in prospects if tag in p["email"]]
    assert len(ids) == 2

    res = await client.post(
        "/api/v1/outreach/admin/enroll", headers=ADMIN,
        json={"prospect_ids": ids, "sequence": "exam-ready-v1"},
    )
    assert res.json()["enrolled"] == 2

    # Dry-run: messages persisted as queued, nothing sent.
    res = await client.post("/api/v1/outreach/admin/run-sequencer", headers=ADMIN)
    body = res.json()
    assert body["dry_run"] is True
    assert body["sent"] == 0

    messages = (await db_session.execute(
        select(OutreachMessage).where(OutreachMessage.to_email.contains(tag))
    )).scalars().all()
    assert len(messages) == 2
    assert all(m.status == "queued" for m in messages)
    assert all("{{" not in m.subject for m in messages)  # tokens rendered

    # Enrollments advanced to step 1 with a future next_send_at.
    enrollments = (await db_session.execute(
        select(OutreachEnrollment)
        .join(OutreachMessage, OutreachMessage.enrollment_id == OutreachEnrollment.id)
        .where(OutreachMessage.to_email.contains(tag))
    )).scalars().all()
    assert all(e.current_step == 1 for e in enrollments)
    assert all(e.next_send_at is not None for e in enrollments)


# ── Unsubscribe ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_unsubscribe_token_round_trip():
    token = make_unsubscribe_token("jane@acme.example")
    assert verify_unsubscribe_token(token) == "jane@acme.example"
    assert verify_unsubscribe_token("garbage") is None
    # Tampered token rejected.
    assert verify_unsubscribe_token(token[:-2] + "xx") is None


@pytest.mark.asyncio
async def test_unsubscribe_stops_enrollment_and_suppresses(client, db_session):
    tag = _tag()
    await _import(client, _csv_for(tag))
    prospects = (await client.get("/api/v1/outreach/admin/prospects", headers=ADMIN)).json()
    jane = next(p for p in prospects if p["email"] == f"jane-{tag}@acme.example")
    await client.post(
        "/api/v1/outreach/admin/enroll", headers=ADMIN,
        json={"prospect_ids": [jane["id"]], "sequence": "exam-ready-v1"},
    )

    token = make_unsubscribe_token(f"jane-{tag}@acme.example")
    res = await client.get(f"/api/v1/outreach/u/{token}")
    assert res.status_code == 200
    assert "unsubscribed" in res.text.lower()

    # Suppression row exists; enrollment stopped.
    supp = (await db_session.execute(
        select(OutreachSuppression).where(OutreachSuppression.email == f"jane-{tag}@acme.example")
    )).scalars().all()
    assert len(supp) == 1
    enr = (await db_session.execute(
        select(OutreachEnrollment).where(OutreachEnrollment.prospect_id == jane["id"])
    )).scalars().one()
    assert enr.status == "stopped"
    assert enr.next_send_at is None

    # Sequencer never picks up a stopped enrollment.
    res = await client.post("/api/v1/outreach/admin/run-sequencer", headers=ADMIN)
    due_for_tag = [d for d in res.json()["details"] if tag in d]
    assert due_for_tag == []


# ── Tracking pixel ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_open_pixel_marks_message(client, db_session):
    tag = _tag()
    await _import(client, _csv_for(tag))
    prospects = (await client.get("/api/v1/outreach/admin/prospects", headers=ADMIN)).json()
    mine = next(p for p in prospects if tag in p["email"])
    await client.post(
        "/api/v1/outreach/admin/enroll", headers=ADMIN,
        json={"prospect_ids": [mine["id"]], "sequence": "exam-ready-v1"},
    )
    await client.post("/api/v1/outreach/admin/run-sequencer", headers=ADMIN)

    msg = (await db_session.execute(
        select(OutreachMessage).where(OutreachMessage.to_email == mine["email"])
    )).scalars().one()
    res = await client.get(f"/api/v1/outreach/t/{msg.id}.gif")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/gif"
    await db_session.refresh(msg)
    assert msg.opened_at is not None


# ── Stats ─────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_stats_shape(client):
    res = await client.get("/api/v1/outreach/admin/stats", headers=ADMIN)
    assert res.status_code == 200
    body = res.json()
    assert "prospects_by_status" in body
    assert "suppression_count" in body
