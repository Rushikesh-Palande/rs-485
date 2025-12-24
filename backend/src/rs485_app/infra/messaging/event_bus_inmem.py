from __future__ import annotations

import asyncio
from typing import Any

from rs485_app.logging_config import get_logger

log = get_logger(__name__)


class InMemoryEventBus:
    """
    In-process pub/sub.

    - Very fast
    - Great for dev and single-node deployments
    - Replaceable by Redis/NATS/Kafka without touching domain logic
    """

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=200)
        self._subscribers.add(q)
        log.info("event_bus_subscribe", subscribers=len(self._subscribers))
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(q)
        log.info("event_bus_unsubscribe", subscribers=len(self._subscribers))

    async def publish(self, event: dict[str, Any]) -> None:
        # Fanout: push to all subscribers, drop if slow to avoid system death spiral.
        dead: list[asyncio.Queue[dict[str, Any]]] = []
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Slow consumer: drop message (best effort).
                # In enterprise mode, you might add per-client backpressure strategy.
                pass
            except Exception:
                dead.append(q)

        for q in dead:
            self._subscribers.discard(q)
