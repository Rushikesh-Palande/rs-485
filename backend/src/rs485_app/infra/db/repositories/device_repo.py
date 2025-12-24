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
    This removes repeated DB hits during high-frequency ingestion.
    """
    def __init__(self, maxsize: int) -> None:
        self.maxsize = maxsize
        self._data: OrderedDict[str, int] = OrderedDict()

    def get(self, key: str) -> int | None:
        val = self._data.get(key)
        if val is not None:
            self._data.move_to_end(key)
        return val

    def set(self, key: str, val: int) -> None:
        self._data[key] = val
        self._data.move_to_end(key)
        if len(self._data) > self.maxsize:
            self._data.popitem(last=False)


class DeviceRepository:
    """
    MySQL-optimized device upsert:
    - device_uid is unique
    - ON DUPLICATE KEY UPDATE keeps it idempotent
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
        # Fast path: in-memory cache
        cached = self.cache.get(device_uid)
        if cached is not None:
            return cached

        # Upsert (idempotent)
        stmt = mysql_insert(Device).values(
            device_uid=device_uid,
            metadata_json=metadata,
        )

        # If device exists, we still “touch” updated_at by updating metadata_json (optional)
        stmt = stmt.on_duplicate_key_update(
            metadata_json=sa.func.coalesce(stmt.inserted.metadata_json, Device.metadata_json),
        )

        conn.execute(stmt)

        # Fetch id (single indexed lookup)
        device_id = conn.execute(
            sa.select(Device.id).where(Device.device_uid == device_uid)
        ).scalar_one()

        self.cache.set(device_uid, int(device_id))
        return int(device_id)
