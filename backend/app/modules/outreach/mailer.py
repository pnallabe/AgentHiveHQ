"""SMTP sender for outreach mail.

Follows the same stdlib-smtplib pattern as modules/inquiries/notifications.py
(no new dependencies), with two additions required for bulk outreach:

  * ``List-Unsubscribe`` + ``List-Unsubscribe-Post`` headers — Gmail/Yahoo
    one-click unsubscribe requirement for senders (enforced since 2024).
  * A configurable From display name / address (founder persona).

Reuses the existing SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD
settings.  Never raises — returns an error string on failure so the
sequencer can record it on the message row.
"""
from __future__ import annotations

import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _build_message(
    *,
    to_email: str,
    subject: str,
    body: str,
    unsubscribe_url: str,
) -> EmailMessage:
    from_email = settings.OUTREACH_FROM_EMAIL or settings.SMTP_USERNAME
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.OUTREACH_FROM_NAME, from_email))
    msg["To"] = to_email
    # Replies land in the founder's real inbox.
    msg["Reply-To"] = from_email
    # One-click unsubscribe (RFC 8058). Gmail shows the "Unsubscribe" button.
    msg["List-Unsubscribe"] = f"<{unsubscribe_url}>"
    msg["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    msg.set_content(body)
    return msg


def _send_sync(msg: EmailMessage) -> None:
    port = settings.SMTP_PORT
    if port == 465:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.SMTP_HOST, port, context=context, timeout=15) as smtp:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)


async def send_outreach_email(
    *,
    to_email: str,
    subject: str,
    body: str,
    unsubscribe_url: str,
) -> Optional[str]:
    """Send one outreach email. Returns None on success, error string on failure."""
    if not settings.SMTP_HOST or not settings.SMTP_PASSWORD:
        return "SMTP not configured (SMTP_HOST / SMTP_PASSWORD unset)"
    try:
        msg = _build_message(
            to_email=to_email,
            subject=subject,
            body=body,
            unsubscribe_url=unsubscribe_url,
        )
        await asyncio.to_thread(_send_sync, msg)
        return None
    except Exception as exc:  # noqa: BLE001 — sequencer records the failure
        logger.warning("Outreach send failed", extra={"to": to_email, "error": str(exc)})
        return str(exc)
