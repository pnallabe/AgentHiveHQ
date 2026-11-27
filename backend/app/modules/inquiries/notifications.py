"""Email notification for new tenant inquiries.

Uses Python's stdlib smtplib — no new dependencies. Works with any SMTP
provider; for Gmail, use an App Password (https://myaccount.google.com/apppasswords).

Configuration (environment variables):
    SMTP_HOST          e.g. smtp.gmail.com
    SMTP_PORT          587 (STARTTLS) or 465 (SSL)
    SMTP_USERNAME      the sending mailbox, e.g. pradeep.nallabelli@gmail.com
    SMTP_PASSWORD      the app password / SMTP credential
    INQUIRY_NOTIFY_TO  comma-separated recipients; defaults to SMTP_USERNAME

If SMTP_HOST or SMTP_PASSWORD is unset, notifications are silently skipped —
the inquiry is still persisted to the database, so nothing is lost.
"""
from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import TYPE_CHECKING

from app.core.config import settings
from app.core.logging import get_logger

if TYPE_CHECKING:
    from app.shared.db_models import TenantInquiry

logger = get_logger(__name__)


def _build_message(inquiry: "TenantInquiry") -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = f"[AgentHive] New demo request — {inquiry.company}"
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = settings.INQUIRY_NOTIFY_TO or settings.SMTP_USERNAME
    # Reply directly to the prospect from the notification email.
    msg["Reply-To"] = inquiry.email

    lines = [
        ("Name", inquiry.name),
        ("Email", inquiry.email),
        ("Company", inquiry.company),
        ("Title", inquiry.title),
        ("Use case", inquiry.use_case),
        ("Monthly volume", inquiry.volume),
        ("Referral source", inquiry.referral),
        ("Inquiry ID", inquiry.id),
    ]
    body = "\n".join(f"{label}: {value}" for label, value in lines if value)
    msg.set_content(f"New tenant inquiry submitted on agenthivehq.com:\n\n{body}\n")
    return msg


def _send_sync(msg: EmailMessage) -> None:
    port = settings.SMTP_PORT
    if port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, port, context=context, timeout=10) as smtp:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)


async def notify_new_inquiry(inquiry: "TenantInquiry") -> None:
    """Fire-and-forget email notification. Never raises — failures are logged."""
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        logger.info(
            "SMTP not configured — skipping inquiry notification",
            extra={"inquiry_id": inquiry.id},
        )
        return

    try:
        msg = _build_message(inquiry)
        await asyncio.to_thread(_send_sync, msg)
        logger.info(
            "Inquiry notification sent",
            extra={"inquiry_id": inquiry.id, "to": settings.INQUIRY_NOTIFY_TO or settings.SMTP_USERNAME},
        )
    except Exception as exc:  # noqa: BLE001 — notification must not break intake
        logger.warning(
            "Failed to send inquiry notification",
            extra={"inquiry_id": inquiry.id, "error": str(exc)},
        )
