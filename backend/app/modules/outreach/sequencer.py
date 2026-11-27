"""Outreach sequencer — picks up due enrollments and sends the next touch.

Run modes
---------
* In-process: called by ``POST /api/v1/outreach/admin/run-sequencer``
  (the Cloud Scheduler target).
* CLI: ``python -m app.modules.outreach.sequencer [--limit N]``

Governance gates (evaluated in order, every send):
  1. ``OUTREACH_SEND_ENABLED`` — master switch; when false the run is a
     dry-run: messages are persisted as ``queued`` and nothing touches SMTP.
  2. Suppression list — prospect email AND domain must be absent.
  3. Daily rate limit — ``OUTREACH_DAILY_LIMIT`` sends per UTC day
     (domain-warmup cap; Gmail workspace starts throttling new senders
     well below 100/day).

Every decision is persisted to ``outreach_messages`` — including dry-run and
suppressed rows — so the pipeline has the same audit trail we sell.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.database import AsyncSessionLocal, create_tables
from app.modules.outreach.mailer import send_outreach_email
from app.modules.outreach.templates import TEMPLATES, render_template
from app.shared.db_models import (
    OutreachEnrollment,
    OutreachMessage,
    OutreachProspect,
    OutreachSequence,
    OutreachSuppression,
)

logger = get_logger(__name__)


# ── Unsubscribe tokens (stateless HMAC — no extra table) ─────────────────────
def make_unsubscribe_token(email: str) -> str:
    """Signed unsubscribe token for an email address."""
    sig = hmac.new(
        settings.SECRET_KEY.encode(), email.lower().encode(), hashlib.sha256,
    ).hexdigest()[:24]
    raw = f"{email.lower()}:{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_unsubscribe_token(token: str) -> Optional[str]:
    """Return the email if the token is valid, else None."""
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        email, sig = raw.rsplit(":", 1)
    except Exception:  # noqa: BLE001 — malformed token
        return None
    expected = hmac.new(
        settings.SECRET_KEY.encode(), email.lower().encode(), hashlib.sha256,
    ).hexdigest()[:24]
    return email if hmac.compare_digest(sig, expected) else None


def unsubscribe_url_for(email: str) -> str:
    return f"{settings.OUTREACH_PUBLIC_BASE_URL}/api/v1/outreach/u/{make_unsubscribe_token(email)}"


# ── Suppression ───────────────────────────────────────────────────────────────
async def is_suppressed(db, email: str) -> bool:
    domain = email.split("@")[-1].lower()
    q = select(OutreachSuppression).where(
        (func.lower(OutreachSuppression.email) == email.lower())
        | (func.lower(OutreachSuppression.domain) == domain)
    )
    return (await db.execute(q)).scalars().first() is not None


# ── Sends today (rate limit) ──────────────────────────────────────────────────
async def sends_today(db) -> int:
    now = datetime.now(tz=timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    q = select(func.count(OutreachMessage.id)).where(
        OutreachMessage.status == "sent",
        OutreachMessage.sent_at >= day_start,
    )
    return int((await db.execute(q)).scalar() or 0)


# ── Template token context ────────────────────────────────────────────────────
def _tokens_for(prospect: OutreachProspect, message_id: str) -> dict[str, str]:
    first_name = prospect.contact_name.strip().split(" ")[0]
    base = settings.OUTREACH_PUBLIC_BASE_URL
    return {
        "first_name": first_name,
        "company": prospect.company,
        "title": prospect.title or "",
        "sender_name": settings.OUTREACH_FROM_NAME,
        "sender_email": settings.OUTREACH_FROM_EMAIL or settings.SMTP_USERNAME,
        "booking_url": settings.OUTREACH_BOOKING_URL,
        "unsubscribe_url": unsubscribe_url_for(prospect.email),
        "pixel_url": f"{base}/api/v1/outreach/t/{message_id}.gif",
    }


# ── Main run ──────────────────────────────────────────────────────────────────
async def run_sequencer(db, *, limit: Optional[int] = None) -> dict:
    """Process all due enrollments. Returns a run summary dict."""
    now = datetime.now(tz=timezone.utc)
    dry_run = not settings.OUTREACH_SEND_ENABLED
    daily_cap = limit or settings.OUTREACH_DAILY_LIMIT

    result = {
        "dry_run": dry_run, "due": 0, "sent": 0, "failed": 0,
        "suppressed": 0, "skipped_rate_limit": 0, "details": [],
    }

    q = (
        select(OutreachEnrollment, OutreachProspect, OutreachSequence)
        .join(OutreachProspect, OutreachEnrollment.prospect_id == OutreachProspect.id)
        .join(OutreachSequence, OutreachEnrollment.sequence_id == OutreachSequence.id)
        .where(
            OutreachEnrollment.status == "active",
            OutreachEnrollment.next_send_at.is_not(None),
            OutreachEnrollment.next_send_at <= now,
            OutreachSequence.active.is_(True),
        )
        .order_by(OutreachEnrollment.next_send_at)
    )
    rows = (await db.execute(q)).all()
    result["due"] = len(rows)

    sent_so_far = await sends_today(db)

    for enrollment, prospect, sequence in rows:
        steps = sorted(sequence.steps, key=lambda s: s["step"])
        next_step = enrollment.current_step + 1
        step_def = next((s for s in steps if s["step"] == next_step), None)

        if step_def is None:  # sequence exhausted
            enrollment.status = "finished"
            enrollment.next_send_at = None
            continue

        template = TEMPLATES.get(step_def["template"])
        if template is None:
            logger.error("Unknown template", extra={"template": step_def["template"]})
            enrollment.status = "finished"
            enrollment.next_send_at = None
            continue

        # ── Gate 2: suppression ─────────────────────────────────────────
        if await is_suppressed(db, prospect.email):
            msg = OutreachMessage(
                enrollment_id=enrollment.id, prospect_id=prospect.id,
                step=next_step, template=template.name,
                to_email=prospect.email, subject=template.subject, body="",
                status="suppressed",
            )
            db.add(msg)
            enrollment.status = "stopped"
            enrollment.next_send_at = None
            prospect.status = "unsubscribed"
            result["suppressed"] += 1
            result["details"].append(f"suppressed: {prospect.email}")
            continue

        # ── Gate 3: daily rate limit ────────────────────────────────────
        if sent_so_far >= daily_cap:
            result["skipped_rate_limit"] += 1
            continue  # leave next_send_at in the past; picked up tomorrow

        # ── Build the message row first so the pixel URL has an id ──────
        msg = OutreachMessage(
            enrollment_id=enrollment.id, prospect_id=prospect.id,
            step=next_step, template=template.name,
            to_email=prospect.email, subject="", body="",
            status="queued",
        )
        db.add(msg)
        await db.flush()  # assigns msg.id

        tokens = _tokens_for(prospect, msg.id)
        subject, body = render_template(template, tokens)
        # Open-tracking pixel appended as a text-safe reference line.
        body_with_pixel = f"{body}\n\n[ref: {tokens['pixel_url']}]"
        msg.subject, msg.body = subject, body_with_pixel

        # ── Gate 1: master switch ───────────────────────────────────────
        if dry_run:
            result["details"].append(f"dry-run: would send step {next_step} to {prospect.email}")
            _advance(enrollment, steps, next_step, now)
            continue

        error = await send_outreach_email(
            to_email=prospect.email, subject=subject, body=body_with_pixel,
            unsubscribe_url=tokens["unsubscribe_url"],
        )
        if error is None:
            msg.status = "sent"
            msg.sent_at = now
            sent_so_far += 1
            result["sent"] += 1
            if prospect.status in ("new", "enrolled"):
                prospect.status = "enrolled"
            result["details"].append(f"sent step {next_step} to {prospect.email}")
        else:
            msg.status = "failed"
            msg.error = error
            result["failed"] += 1
            result["details"].append(f"FAILED {prospect.email}: {error}")
            continue  # retry next run — do not advance

        _advance(enrollment, steps, next_step, now)

    await db.commit()
    logger.info("Sequencer run complete", extra=result)
    return result


def _advance(enrollment: OutreachEnrollment, steps: list, just_sent: int, now: datetime) -> None:
    """Move the enrollment to the next step (or finish it)."""
    enrollment.current_step = just_sent
    following = next((s for s in steps if s["step"] == just_sent + 1), None)
    if following is None:
        enrollment.status = "finished"
        enrollment.next_send_at = None
    else:
        enrollment.next_send_at = now + timedelta(days=following["delay_days"])


# ── CLI ───────────────────────────────────────────────────────────────────────
async def _main() -> None:
    parser = argparse.ArgumentParser(description="Run the outreach sequencer")
    parser.add_argument("--limit", type=int, default=None, help="Override daily send cap")
    args = parser.parse_args()

    configure_logging(settings.APP_LOG_LEVEL)
    await create_tables()
    async with AsyncSessionLocal() as db:
        summary = await run_sequencer(db, limit=args.limit)
    for line in summary.pop("details"):
        print(f"  {line}")
    print(summary)


if __name__ == "__main__":
    asyncio.run(_main())
