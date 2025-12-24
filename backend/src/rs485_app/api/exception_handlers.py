from __future__ import annotations

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from rs485_app.logging_config import get_logger

log = get_logger(__name__)


def _req_id(request: Request) -> str | None:
    # middleware sets these on request.state
    return getattr(request.state, "request_id", None)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Standard HTTP errors (404, 401, etc.) with request_id in response.
    """
    log.warning(
        "http_exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"type": "http_error", "message": exc.detail},
            "request_id": _req_id(request),
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Request validation errors (422) with request_id in response.
    """
    log.warning(
        "request_validation_failed",
        errors=exc.errors(),
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": {"type": "validation_error", "details": exc.errors()},
            "request_id": _req_id(request),
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Any unexpected exception:
    - logs stacktrace with exact file/line
    - returns request_id so frontend can report it
    """
    log.exception(
        "unhandled_exception",
        path=str(request.url.path),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {"type": "internal_error", "message": "Internal Server Error"},
            "request_id": _req_id(request),
        },
    )
