from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class TelemetryEvent:
    """
    Domain model for a single telemetry "tick".

    Keep domain models framework-agnostic:
    - no FastAPI
    - no SQLAlchemy
    - no Redis
    """

    ts: datetime
    device_id: str
    metrics: dict[str, float]
    quality: dict[str, Any]
