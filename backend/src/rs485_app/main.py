from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from rs485_app.api.exception_handlers import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from rs485_app.api.middleware import RequestContextMiddleware
from rs485_app.api.routers.health import router as health_router
from rs485_app.api.routers.telemetry import router as telemetry_router
from rs485_app.api.routers.ws_realtime import router as ws_router
from rs485_app.bootstrap import AppRuntime
from rs485_app.constants import API_PREFIX
from rs485_app.logging_config import configure_logging, get_logger
from rs485_app.settings import load_settings

log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan hook (enterprise style):

    Startup:
    - Load typed settings (fail-fast)
    - Configure logging early (DEV pretty / PROD JSON)
    - Start runtime (DB engine, DB writer, ingestion pipeline)
    - Attach shared components to app.state for routers to use

    Shutdown:
    - Stop runtime cleanly (cancel ingestion + stop DB writer + dispose engine)
    - Never let CancelledError bubble and break shutdown
    """
    app_settings = load_settings()

    # Logging early -> everything from startup is captured & structured
    configure_logging(log_level=app_settings.log_level, app_env=app_settings.app_env)

    log.info(
        "app_starting",
        app_name=app_settings.app_name,
        env=app_settings.app_env,
        serial_mode=app_settings.serial_mode,
    )

    runtime = AppRuntime(settings=app_settings)
    await runtime.start()

    # Attach shared runtime components to app.state (single source of truth)
    app.state.settings = app_settings
    app.state.event_bus = runtime.event_bus
    app.state.runtime = runtime

    try:
        yield
    finally:
        log.info("app_stopping")
        await runtime.stop()
        log.info("app_stopped")


def create_app() -> FastAPI:
    """
    Application factory.

    Why factory:
    - easier testing (override dependencies)
    - clean imports (avoid side effects)
    - consistent enterprise pattern
    """
    app = FastAPI(
        title="RS-485 Enterprise Telemetry",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Global exception handlers (enterprise)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Middleware
    app.add_middleware(RequestContextMiddleware)

    # Routers (REST)
    app.include_router(health_router, prefix=API_PREFIX)
    app.include_router(telemetry_router)  # /api/telemetry/... history for graphs

    # Routers (WebSocket) - absolute paths inside router
    app.include_router(ws_router)

    return app


app = create_app()
