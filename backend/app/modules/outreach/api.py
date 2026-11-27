"""FastAPI router for the outreach engine.

Mounted at: /api/v1/outreach
Wired in:   app/main.py

Admin endpoints (X-Outreach-Admin-Key header):
    POST /admin/prospects/import   — CSV import (multipart)
    GET  /admin/prospects          — list prospects (filter by status)
    POST /admin/enroll             — enroll prospects into a sequence
    POST /admin/run-sequencer      — process due touches (Cloud Scheduler target)
    GET  /admin/stats              — funnel + engagement stats
    POST /admin/suppressions       — manually suppress an email or domain

Public endpoints (no auth — linked from outbound email):
    GET  /u/{token}                — one-click unsubscribe (RFC 8058)
    POST /u/{token}                — one-click unsubscribe (Gmail POST)
    GET  /t/{message_id}.gif       — open-tracking pixel
    GET  /c/{message_id}           — click-tracking redirect (?to=<url>)
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.database import get_db
from app.modules.outreach.schemas import (
    EnrollRequest,
    EnrollResult,
    ImportResult,
    OutreachStats,
    ProspectIn,
    ProspectOut,
    SequencerRunResult,
    SequenceOut,
)
from app.modules.outreach.sequencer import (
    is_suppressed,
    run_sequencer,
    verify_unsubscribe_token,
)
from app.modules.outreach.templates import EXAM_READY_SEQUENCE
from app.shared.db_models import (
    OutreachEnrollment,
    OutreachMessage,
    OutreachProspect,
    OutreachSequence,
    OutreachSuppression,
)

logger = get_logger(__name__)
router = APIRouter()

# 1×1 transparent GIF
_PIXEL = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000"
    "010001000002024401003b"
)


# ── Admin auth ────────────────────────────────────────────────────────────────
async def require_outreach_admin(x_outreach_admin_key: str = Header(default="")) -> None:
    if not settings.OUTREACH_ADMIN_KEY:
        raise HTTPException(status_code=503, detail="Outreach admin API not configured")
    if x_outreach_admin_key != settings.OUTREACH_ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid outreach admin key")


# ── Default sequence bootstrap ────────────────────────────────────────────────
async def ensure_default_sequence(db: AsyncSession) -> OutreachSequence:
    q = select(OutreachSequence).where(OutreachSequence.name == EXAM_READY_SEQUENCE["name"])
    seq = (await db.execute(q)).scalars().first()
    if seq is None:
        seq = OutreachSequence(
            name=EXAM_READY_SEQUENCE["name"],
            description=EXAM_READY_SEQUENCE["description"],
            steps=EXAM_READY_SEQUENCE["steps"],
        )
        db.add(seq)
        await db.flush()
    return seq


# =============================================================================
# Admin endpoints
# =============================================================================
@router.post("/admin/prospects/import", response_model=ImportResult,
             dependencies=[Depends(require_outreach_admin)])
async def import_prospects_csv(
    file: UploadFile, db: AsyncSession = Depends(get_db),
) -> ImportResult:
    """Import prospects from CSV. Required columns: company, email, contact_name.
    Optional: domain, title, segment, aum_band, notes, source."""
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))
    created = dupes = suppressed = 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):  # row 1 = header
        try:
            prospect_in = ProspectIn(**{k: (v or None) for k, v in row.items() if k})
        except Exception as exc:  # noqa: BLE001 — report row-level validation errors
            errors.append(f"row {i}: {exc}")
            continue

        email = str(prospect_in.email).lower()
        exists = (await db.execute(
            select(OutreachProspect).where(func.lower(OutreachProspect.email) == email)
        )).scalars().first()
        if exists:
            dupes += 1
            continue
        if await is_suppressed(db, email):
            suppressed += 1
            continue

        db.add(OutreachProspect(
            company=prospect_in.company.strip(),
            email=email,
            contact_name=prospect_in.contact_name.strip(),
            domain=(prospect_in.domain or "").strip().lower() or None,
            title=prospect_in.title,
            segment=prospect_in.segment,
            aum_band=prospect_in.aum_band,
            notes=prospect_in.notes,
            source=prospect_in.source or "csv-import",
        ))
        created += 1

    await db.commit()
    logger.info("Prospect import", extra={"imported": created, "dupes": dupes})
    return ImportResult(created=created, skipped_duplicates=dupes,
                        skipped_suppressed=suppressed, errors=errors[:20])


@router.get("/admin/prospects", response_model=list[ProspectOut],
            dependencies=[Depends(require_outreach_admin)])
async def list_prospects(
    status: Optional[str] = None, limit: int = 200, db: AsyncSession = Depends(get_db),
) -> list[ProspectOut]:
    q = select(OutreachProspect).order_by(OutreachProspect.created_at.desc()).limit(limit)
    if status:
        q = q.where(OutreachProspect.status == status)
    return list((await db.execute(q)).scalars().all())


@router.post("/admin/enroll", response_model=EnrollResult,
             dependencies=[Depends(require_outreach_admin)])
async def enroll_prospects(
    payload: EnrollRequest, db: AsyncSession = Depends(get_db),
) -> EnrollResult:
    sequence = await ensure_default_sequence(db)
    now = datetime.now(tz=timezone.utc)
    enrolled = 0
    skipped: list[str] = []

    for pid in payload.prospect_ids:
        prospect = await db.get(OutreachProspect, pid)
        if prospect is None:
            skipped.append(f"{pid}: not found")
            continue
        if await is_suppressed(db, prospect.email):
            skipped.append(f"{prospect.email}: suppressed")
            continue
        already = (await db.execute(
            select(OutreachEnrollment).where(
                OutreachEnrollment.prospect_id == pid,
                OutreachEnrollment.status == "active",
            )
        )).scalars().first()
        if already:
            skipped.append(f"{prospect.email}: already enrolled")
            continue

        db.add(OutreachEnrollment(
            prospect_id=pid, sequence_id=sequence.id,
            current_step=0, next_send_at=now, status="active",
        ))
        prospect.status = "enrolled"
        enrolled += 1

    await db.commit()
    return EnrollResult(enrolled=enrolled, skipped=skipped)


@router.post("/admin/run-sequencer", response_model=SequencerRunResult,
             dependencies=[Depends(require_outreach_admin)])
async def run_sequencer_endpoint(db: AsyncSession = Depends(get_db)) -> SequencerRunResult:
    """Process due touches. Cloud Scheduler calls this daily."""
    return SequencerRunResult(**await run_sequencer(db))


@router.get("/admin/stats", response_model=OutreachStats,
            dependencies=[Depends(require_outreach_admin)])
async def outreach_stats(db: AsyncSession = Depends(get_db)) -> OutreachStats:
    async def _count_by(model, col) -> dict[str, int]:
        q = select(col, func.count()).group_by(col)
        return {str(k): int(v) for k, v in (await db.execute(q)).all()}

    week_ago = datetime.now(tz=timezone.utc) - timedelta(days=7)
    sent_7d = int((await db.execute(
        select(func.count(OutreachMessage.id)).where(
            OutreachMessage.status == "sent", OutreachMessage.sent_at >= week_ago)
    )).scalar() or 0)
    total_sent = int((await db.execute(
        select(func.count(OutreachMessage.id)).where(OutreachMessage.status == "sent")
    )).scalar() or 0)
    opened = int((await db.execute(
        select(func.count(OutreachMessage.id)).where(OutreachMessage.opened_at.is_not(None))
    )).scalar() or 0)
    replied = int((await db.execute(
        select(func.count(OutreachMessage.id)).where(OutreachMessage.replied_at.is_not(None))
    )).scalar() or 0)
    suppressions = int((await db.execute(
        select(func.count(OutreachSuppression.id))
    )).scalar() or 0)
    active = int((await db.execute(
        select(func.count(OutreachEnrollment.id)).where(OutreachEnrollment.status == "active")
    )).scalar() or 0)

    return OutreachStats(
        prospects_by_status=await _count_by(OutreachProspect, OutreachProspect.status),
        messages_by_status=await _count_by(OutreachMessage, OutreachMessage.status),
        sent_last_7d=sent_7d,
        open_rate=(opened / total_sent) if total_sent else None,
        reply_rate=(replied / total_sent) if total_sent else None,
        suppression_count=suppressions,
        active_enrollments=active,
    )


@router.post("/admin/suppressions", dependencies=[Depends(require_outreach_admin)])
async def add_suppression(
    email: Optional[str] = None, domain: Optional[str] = None,
    reason: str = "manual", db: AsyncSession = Depends(get_db),
) -> dict:
    if not email and not domain:
        raise HTTPException(status_code=422, detail="Provide email or domain")
    db.add(OutreachSuppression(
        email=email.lower() if email else None,
        domain=domain.lower() if domain else None,
        reason=reason,
    ))
    await db.commit()
    return {"status": "suppressed", "email": email, "domain": domain}


@router.get("/admin/sequences", response_model=list[SequenceOut],
            dependencies=[Depends(require_outreach_admin)])
async def list_sequences(db: AsyncSession = Depends(get_db)) -> list[SequenceOut]:
    await ensure_default_sequence(db)
    return list((await db.execute(select(OutreachSequence))).scalars().all())


# =============================================================================
# Public endpoints (linked from outbound email — no auth)
# =============================================================================
_UNSUBSCRIBED_HTML = """<!doctype html><html><head><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;
align-items:center;min-height:80vh;color:#111}main{max-width:28rem;text-align:center}
a{color:#4f46e5}</style></head><body><main>
<h1>You're unsubscribed</h1>
<p><strong>{email}</strong> won't receive further outreach from AgentHive.
No follow-ups, no sequences — the suppression is permanent and logged.</p>
<p>If this was a mistake, reply to any earlier email and we'll sort it out.</p>
</main></body></html>"""


async def _do_unsubscribe(db: AsyncSession, token: str) -> Optional[str]:
    email = verify_unsubscribe_token(token)
    if email is None:
        return None
    if not await is_suppressed(db, email):
        db.add(OutreachSuppression(email=email, reason="unsubscribe"))
    # Stop any active enrollments for this address.
    prospects = (await db.execute(
        select(OutreachProspect).where(func.lower(OutreachProspect.email) == email)
    )).scalars().all()
    for prospect in prospects:
        prospect.status = "unsubscribed"
        enrollments = (await db.execute(
            select(OutreachEnrollment).where(
                OutreachEnrollment.prospect_id == prospect.id,
                OutreachEnrollment.status == "active",
            )
        )).scalars().all()
        for enr in enrollments:
            enr.status = "stopped"
            enr.next_send_at = None
    await db.commit()
    logger.info("Outreach unsubscribe", extra={"email": email})
    return email


@router.get("/u/{token}", response_class=HTMLResponse)
async def unsubscribe_get(token: str, db: AsyncSession = Depends(get_db)) -> HTMLResponse:
    email = await _do_unsubscribe(db, token)
    if email is None:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")
    return HTMLResponse(_UNSUBSCRIBED_HTML.replace("{email}", email))


@router.post("/u/{token}")
async def unsubscribe_post(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    """RFC 8058 one-click POST (Gmail/Yahoo unsubscribe button)."""
    email = await _do_unsubscribe(db, token)
    if email is None:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe link")
    return {"status": "unsubscribed"}


@router.get("/t/{message_id}.gif")
async def track_open(message_id: str, db: AsyncSession = Depends(get_db)) -> Response:
    msg = await db.get(OutreachMessage, message_id)
    if msg is not None and msg.opened_at is None:
        msg.opened_at = datetime.now(tz=timezone.utc)
        await db.commit()
    return Response(content=_PIXEL, media_type="image/gif",
                    headers={"Cache-Control": "no-store"})


@router.get("/c/{message_id}")
async def track_click(
    message_id: str, to: str, db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    msg = await db.get(OutreachMessage, message_id)
    if msg is not None and msg.clicked_at is None:
        msg.clicked_at = datetime.now(tz=timezone.utc)
        await db.commit()
    if not to.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="Invalid redirect target")
    return RedirectResponse(url=to, status_code=302)
