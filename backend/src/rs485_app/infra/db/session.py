from __future__ import annotations

import re
from typing import Final

import sqlalchemy as sa
from sqlalchemy import create_engine

from rs485_app.logging_config import get_logger
from rs485_app.settings import Settings

log = get_logger(__name__)

_PASSWORD_RE: Final[re.Pattern[str]] = re.compile(r":([^:@/]+)@")


def _redact_db_url(url: str) -> str:
    """
    Never log DB passwords.
    mysql+pymysql://user:pass@127.0.0.1/db -> mysql+pymysql://user:***@127.0.0.1/db
    """
    return _PASSWORD_RE.sub(":***@", url)


def create_engine_from_settings(settings: Settings) -> sa.Engine:
    """
    SQLAlchemy engine factory (sync MySQL driver).

    Why sync:
    - You use PyMySQL (sync). Writer runs in a thread to keep FastAPI loop fast.

    Pool tuning (important for high-rate ingestion):
    - pool_pre_ping: removes stale connections
    - pool_recycle: avoids "MySQL server has gone away"
    - pool_size/max_overflow: supports API + writer concurrently
    """
    safe_url = _redact_db_url(settings.database_url)
    log.info("db_engine_creating", url=safe_url)

    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=1800,   # 30 minutes
        pool_size=10,
        max_overflow=20,
        future=True,
    )
