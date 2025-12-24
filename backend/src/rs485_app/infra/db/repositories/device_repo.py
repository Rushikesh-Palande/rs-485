from __future__ import annotations

from collections import OrderedDict
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import insert as mysql_insert

from rs485_app.infra.db.models import Device
from rs485_app.logging_config import get_logger

log = get_logger(__name__)


class DeviceIdCache:
    """
    Tiny LRU cache for device_uid -> device_id.

    Why this matters:
    - Telemetry systems repeat device_uid constantly.
    - Without cache you'd do a DB lookup per event (too slow).
    - With cache you do 0 DB roundtrips for known devices.
    """

    def __init__(self, maxsize: int) -> None:
        self.maxsize = maxsize
        self._data: OrderedDict[str, int] = OrderedDict()

    def get(self, key: str) -> int | None:
        val = self._data.get(key)
        if val is not None:
            # LRU bump: most recently used goes to end
            self._data.move_to_end(key)
        return val

    def set(self, key: str, val: int) -> None:
        self._data[key] = val
        self._data.move_to_end(key)
        if len(self._data) > self.maxsize:
            # Evict least recently used
            self._data.popitem(last=False)


class DeviceRepository:
    """
    Device upsert optimized for MySQL high-rate ingestion.

    Goal:
    - Given device_uid, return devices.id quickly and safely.
    - Works correctly even if multiple writers ingest the same new device_uid at once.

    Technique:
    - MySQL "upsert + LAST_INSERT_ID" trick:
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      => After executing, SELECT LAST_INSERT_ID() returns:
         - newly inserted id (if inserted)
         - existing row id (if duplicate)

    This avoids:
    - extra SELECT on the hot path
    - race windows between insert and select
    """

    def __init__(self, cache_size: int = 5000) -> None:
        self.cache = DeviceIdCache(cache_size)

    def get_or_create_device_id(
        self,
        conn: sa.Connection,
        *,
        device_uid: str,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        # ---------------------------
        # 1) Fast path: LRU cache
        # ---------------------------
        cached = self.cache.get(device_uid)
        if cached is not None:
            return cached

        # ---------------------------
        # 2) Upsert
        # ---------------------------
        values: dict[str, Any] = {"device_uid": device_uid}

        # Only write metadata if provided.
        # This avoids write amplification when metadata is constantly None.
        if metadata is not None:
            values["metadata_json"] = metadata

        stmt = mysql_insert(Device).values(**values)

        # Upsert behavior:
        # - If new row inserted => id is the inserted id
        # - If duplicate device_uid => set id = LAST_INSERT_ID(id)
        #   so we can retrieve the id in *one* extra cheap query.
        update_map: dict[str, Any] = {
            "id": sa.text("LAST_INSERT_ID(id)"),
        }

        # If metadata is provided, update it (but don't overwrite existing with NULL)
        if metadata is not None:
            update_map["metadata_json"] = sa.func.coalesce(
                stmt.inserted.metadata_json,  # new value
                Device.metadata_json,         # fallback to existing
            )

        stmt = stmt.on_duplicate_key_update(**update_map)

        conn.execute(stmt)

        # MySQL guarantees LAST_INSERT_ID() is connection-scoped.
        device_id = conn.execute(sa.text("SELECT LAST_INSERT_ID()")).scalar_one()

        device_id_int = int(device_id)
        self.cache.set(device_uid, device_id_int)

        log.info(
            "device_id_resolved",
            device_uid=device_uid,
            device_id=device_id_int,
            cache_size=len(self.cache._data),
        )

        return device_id_int
