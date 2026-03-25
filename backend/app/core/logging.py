"""Structured JSON logging for AgentHive backend.

Sets up a single root logger that emits JSON lines to stdout.
Log level is driven by APP_LOG_LEVEL in config.
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class _JsonFormatter(logging.Formatter):
    """Format every log record as a single JSON line."""

    SKIP_ATTRS = frozenset(
        {
            "args",
            "asctime",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "id",
            "levelname",
            "levelno",
            "lineno",
            "message",
            "module",
            "msecs",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "stack_info",
            "thread",
            "threadName",
        }
    )

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        log_dict: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.message,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Attach extra fields the caller passed via `extra={…}`.
        for key, value in record.__dict__.items():
            if key not in self.SKIP_ATTRS:
                log_dict[key] = value

        if record.exc_info:
            log_dict["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_dict, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Wire up root logger with JSON formatter.  Call once at app startup."""
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    # Remove any handlers already attached (e.g. by uvicorn or pytest).
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(numeric_level)

    # Quieten noisy third-party loggers.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger.  Always prefer this over ``logging.getLogger``."""
    return logging.getLogger(name)
