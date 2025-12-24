from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import sqlalchemy as sa

from rs485_app.infra.db.models import Device, TelemetrySample
from rs485_app.logging_config import get_logger

log = get_logger(__name__)


def _utc_naive_from_iso(ts_iso: str) -> datetime:
    """
    Convert ISO timestamp to naive UTC datetime.

    Why:
    - MySQL DATETIME has no timezone
    - We store all timestamps as UTC-naive consistently
    """
    dt = datetime.fromisoformat(ts_iso.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).replace(tzinfo=None)


class TelemetryRepository:
    """
    High-throughput inserts (executemany).

    Important:
    - this class is intentionally "thin": it does not manage transactions
    - caller decides transaction boundary (we use engine.begin() in the writer)
    """

    def insert_batch(
        self,
        conn: sa.Connection,
        *,
        device_id: int,
        events: list[dict[str, Any]],
        source: str,
    ) -> int:
        if not events:
            return 0

        rows: list[dict[str, Any]] = []
        for e in events:
            quality = e.get("quality") or {}
            rows.append(
                {
                    "device_id": device_id,
                    "ts": _utc_naive_from_iso(e["ts"]),
                    "metrics_json": e.get("metrics") or {},
                    "quality_json": quality or None,
                    "crc_ok": quality.get("crc_ok"),
                    "frame_seq": quality.get("frame_seq"),
                    "raw_frame": e.get("raw_frame"),
                    "source": source,
                }
            )

        conn.execute(sa.insert(TelemetrySample), rows)
        return len(rows)

    def fetch_history(
        self,
        conn: sa.Connection,
        *,
        device_uid: str,
        start: datetime | None,
        end: datetime | None,
        limit: int = 2000,
    ) -> list[dict[str, Any]]:
        """
        Query for charting: returns [{ts, metrics, quality}, ...]
        Uses (device_id, ts) index for speed.
        """
        q = (
            sa.select(
                TelemetrySample.ts,
                TelemetrySample.metrics_json,
                TelemetrySample.quality_json,
            )
            .select_from(TelemetrySample)
            .join(Device, Device.id == TelemetrySample.device_id)
            .where(Device.device_uid == device_uid)
            .order_by(TelemetrySample.ts.desc())
            .limit(limit)
        )

        if start is not None:
            q = q.where(TelemetrySample.ts >= start)
        if end is not None:
            q = q.where(TelemetrySample.ts <= end)

        rows = conn.execute(q).all()

        # Return ascending time for charting
        return [
            {"ts": r.ts.isoformat(), "metrics": r.metrics_json, "quality": r.quality_json}
            for r in reversed(rows)
        ]
