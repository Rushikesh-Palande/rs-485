from __future__ import annotations

import time
from collections.abc import Callable

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

    ✅ Adds request_id/correlation_id to request.state and response headers
    ✅ Binds IDs into structlog contextvars so *all logs include them*
    ✅ Logs request duration + status
    ✅ Ensures contextvars do not leak between requests (critical in async apps)

    This is a "high signal" middleware:
    - No noisy logs
    - One completion log per request
    - Full stacktrace for failures
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Response],
    ) -> Response:
        request_id, correlation_id = RequestContext.extract_ids(dict(request.headers))

        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        bind_request_context(request_id=request_id, correlation_id=correlation_id)

        t0 = time.perf_counter()
        response: Response | None = None

        try:
            response = await call_next(request)
            return response
        except Exception:
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

            if response is not None:
                response.headers[HDR_REQUEST_ID] = request_id
                response.headers[HDR_CORRELATION_ID] = correlation_id

            clear_request_context()
