from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from fastapi import APIRouter, Query, Request

from rs485_app.infra.db.repositories.telemetry_repo import TelemetryRepository
from rs485_app.logging_config import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("/{device_uid}/history")
def get_history(
    request: Request,
    device_uid: str,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=20000),
):
    """
    History endpoint for charts.

    Query is optimized by:
    - JOIN devices -> telemetry_samples
    - composite index (device_id, ts)
    """
    runtime = request.app.state.runtime
    engine: sa.Engine = runtime.engine  # type: ignore[attr-defined]

    repo = TelemetryRepository()
    with engine.connect() as conn:
        rows = repo.fetch_history(conn, device_uid=device_uid, start=start, end=end, limit=limit)

    log.info("telemetry_history_served", device_uid=device_uid, points=len(rows))
    return {"device_uid": device_uid, "points": rows}
