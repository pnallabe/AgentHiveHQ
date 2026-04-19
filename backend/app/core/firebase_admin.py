"""Firebase Admin SDK initialisation and helper utilities.

Provides a singleton Firebase Admin app for token verification and
custom-claim management (executive role assignment).

Usage
-----
    from app.core.firebase_admin import verify_id_token, set_executive_role

    claims = await verify_id_token(bearer_token)
    await set_executive_role(uid="abc123")
"""
from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_FB_AVAILABLE: bool | None = None


def _is_firebase_available() -> bool:
    global _FB_AVAILABLE
    if _FB_AVAILABLE is None:
        try:
            import firebase_admin  # noqa: F401
            _FB_AVAILABLE = True
        except ImportError:
            _FB_AVAILABLE = False
            logger.warning(
                "firebase-admin not installed — Firebase token verification disabled. "
                "Install with: pip install firebase-admin"
            )
    return _FB_AVAILABLE


@lru_cache(maxsize=1)
def _get_firebase_app() -> Any:
    """Return the initialised Firebase Admin App (singleton)."""
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        return firebase_admin.get_app()

    creds_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if creds_path and os.path.isfile(creds_path):
        cred = credentials.Certificate(creds_path)
        app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialised (service-account key)", extra={"key": creds_path})
    else:
        # ADC — works on Cloud Run / GKE or when `gcloud auth application-default login` is run
        app = firebase_admin.initialize_app()
        logger.info("Firebase Admin initialised (ADC)")

    return app


def verify_id_token(token: str) -> dict:
    """Verify a Firebase ID token and return the decoded claims dict.

    Raises
    ------
    ValueError
        If firebase-admin is not installed or the token is invalid.
    """
    if not _is_firebase_available():
        raise ValueError("firebase-admin package not installed")

    _get_firebase_app()
    from firebase_admin import auth

    decoded = auth.verify_id_token(token)
    return decoded  # type: ignore[return-value]


async def set_executive_role(uid: str) -> None:
    """Set custom claim ``role='executive'`` on a Firebase user.

    Should be called from a secure admin endpoint or management script.
    After calling this, the user must sign out and sign back in for the
    new claim to be reflected in their ID token.

    Parameters
    ----------
    uid:
        Firebase user UID (from the Firebase console or ``auth.get_user_by_email``).
    """
    if not _is_firebase_available():
        raise RuntimeError("firebase-admin package not installed")

    _get_firebase_app()
    from firebase_admin import auth

    auth.set_custom_user_claims(uid, {"role": "executive"})
    logger.info("Executive role assigned", extra={"uid": uid})
