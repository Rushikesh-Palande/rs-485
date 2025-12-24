from __future__ import annotations

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from rs485_app.constants import HDR_CORRELATION_ID, HDR_REQUEST_ID
from rs485_app.logging_config import (
    RequestContext,
    bind_request_context,
    clear_request_context,
    get_logger,
)

log = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Enterprise middleware:
    ✅ Adds request_id/correlation_id to response headers
    ✅ Binds request_id/correlation_id into contextvars
       => all logs automatically contain them
    ✅ Logs request duration + status
    ✅ Logs full exception with stacktrace and callsite
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id, correlation_id = RequestContext.extract_ids(dict(request.headers))

        # Attach to request.state (useful for handlers)
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        # Bind into structlog contextvars (this is key for global log context)
        bind_request_context(request_id=request_id, correlation_id=correlation_id)

        t0 = time.perf_counter()
        response: Response | None = None

        try:
            response = await call_next(request)
            return response
        except Exception:
            # This logs with full stacktrace + filename/lineno/func_name automatically.
            log.exception(
                "http_request_failed",
                method=request.method,
                path=str(request.url.path),
            )
            raise
        finally:
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
            status_code = response.status_code if response else None

            log.info(
                "http_request",
                method=request.method,
                path=str(request.url.path),
                status_code=status_code,
                duration_ms=round(elapsed_ms, 2),
            )

            # Ensure response headers exist if response was created
            if response is not None:
                response.headers[HDR_REQUEST_ID] = request_id
                response.headers[HDR_CORRELATION_ID] = correlation_id

            # Critical: prevent async context leaking into next request
            clear_request_context()
