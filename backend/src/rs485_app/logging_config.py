from __future__ import annotations

import logging
import logging.config
import os
import time
import uuid
from typing import Any, Final

import orjson
import structlog
from structlog.contextvars import bind_contextvars, clear_contextvars, merge_contextvars

from rs485_app.constants import HDR_CORRELATION_ID, HDR_REQUEST_ID

DEFAULT_LOG_LEVEL: Final[str] = "INFO"


def _orjson_dumps(obj: Any) -> str:
    """
    orjson returns bytes but structlog renderers expect str.
    """
    return orjson.dumps(obj, option=orjson.OPT_NON_STR_KEYS).decode("utf-8")


def _is_dev(app_env: str) -> bool:
    return (app_env or "").lower() in {"dev", "development", "local"}


def configure_logging(
    log_level: str | None = None,
    app_env: str | None = None,
    **_ignored: Any,  # backward/forward compatibility (won't crash on extra kwargs)
) -> None:
    """
    Enterprise logging system tuned for *debuggability*.

    Modes
    -----
    DEV  (APP_ENV=dev)  -> pretty colored console logs (human readable)
    PROD (APP_ENV=prod) -> JSON logs (machine friendly for ELK/Loki/Datadog)

    Guarantees
    ----------
    ✅ every log line contains filename + lineno + function (callsite)
    ✅ exceptions include full stacktrace (exact file/line)
    ✅ request_id/correlation_id/ws context automatically injected (contextvars)
    ✅ uvicorn/fastapi logs normalized into the same format
    ✅ NO duplicate "log inside log" lines (clean single-line output)

    Notes
    -----
    - structlog + stdlib are unified by `structlog.stdlib.ProcessorFormatter`.
    - structlog emits event dicts; stdlib formatter renders once.
    """

    level_name = (log_level or os.getenv("LOG_LEVEL") or DEFAULT_LOG_LEVEL).upper()
    app_env_val = app_env or os.getenv("APP_ENV") or "dev"
    dev_mode = _is_dev(app_env_val)

    # Adds file/line/function/module/path for ultra-fast debugging.
    callsite = structlog.processors.CallsiteParameterAdder(
        parameters=[
            structlog.processors.CallsiteParameter.FILENAME,
            structlog.processors.CallsiteParameter.LINENO,
            structlog.processors.CallsiteParameter.FUNC_NAME,
            structlog.processors.CallsiteParameter.MODULE,
            structlog.processors.CallsiteParameter.PATHNAME,
        ]
    )

    # This chain runs BEFORE rendering for both structlog and stdlib logs.
    # IMPORTANT: add_logger_name/add_log_level are from structlog.stdlib for compatibility.
    shared_pre_chain = [
        merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        callsite,
    ]

    renderer = (
        structlog.dev.ConsoleRenderer(colors=True)
        if dev_mode
        else structlog.processors.JSONRenderer(serializer=_orjson_dumps)
    )

    # This runs inside ProcessorFormatter just before final render.
    formatter_processors = [
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,  # renders full stack trace with callsite info
        structlog.processors.UnicodeDecoder(),
        renderer,
    ]

    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "structured": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processors": formatter_processors,
                "foreign_pre_chain": shared_pre_chain,
            }
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "level": level_name,
                "formatter": "structured",
                "stream": "ext://sys.stdout",
            }
        },
        "root": {"handlers": ["default"], "level": level_name},
        "loggers": {
            # Normalize uvicorn + access logs into root handler/format
            "uvicorn": {"level": level_name, "propagate": True},
            "uvicorn.error": {"level": level_name, "propagate": True},
            "uvicorn.access": {"level": level_name, "propagate": True},
            "fastapi": {"level": level_name, "propagate": True},
            "starlette": {"level": level_name, "propagate": True},
        },
    }

    logging.config.dictConfig(logging_config)

    # structlog config:
    # - emit event dicts
    # - stdlib ProcessorFormatter does the rendering exactly once
    structlog.configure(
        processors=[
            *shared_pre_chain,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=False,
    )

    get_logger(__name__).info(
        "logging_configured",
        app_env=app_env_val,
        dev_mode=dev_mode,
        log_level=level_name,
    )


def new_request_id() -> str:
    return uuid.uuid4().hex


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


def bind_request_context(request_id: str, correlation_id: str) -> None:
    """
    After this, every log line automatically includes:
    - request_id
    - correlation_id
    """
    bind_contextvars(request_id=request_id, correlation_id=correlation_id)


def bind_ws_context(
    *,
    ws_request_id: str,
    ws_client_id: str,
    ws_path: str,
    device_id: str | None = None,
) -> None:
    """
    WebSocket context so every WS log line includes stable identifiers.
    """
    bind_contextvars(
        ws_request_id=ws_request_id,
        ws_client_id=ws_client_id,
        ws_path=ws_path,
        device_id=device_id,
    )


def clear_request_context() -> None:
    """
    Critical under async: prevent context leaking into the next request/connection.
    """
    clear_contextvars()


class RequestContext:
    @staticmethod
    def extract_ids(headers: dict[str, str]) -> tuple[str, str]:
        request_id = headers.get(HDR_REQUEST_ID) or new_request_id()
        correlation_id = headers.get(HDR_CORRELATION_ID) or request_id
        return request_id, correlation_id

    @staticmethod
    def now_ms() -> int:
        return int(time.time() * 1000)
