from __future__ import annotations

import asyncio
import time
from typing import Any

import sqlalchemy as sa

from rs485_app.infra.db.repositories.device_repo import DeviceRepository
from rs485_app.infra.db.repositories.telemetry_repo import TelemetryRepository
from rs485_app.logging_config import get_logger

log = get_logger(__name__)


class TelemetryDbWriter:
    """
    High-throughput DB writer.

    Design:
    - async ingestion pushes events into an asyncio.Queue (non-blocking)
    - a single consumer drains queue and flushes to MySQL in batches
    - DB writes run in a thread to avoid blocking the event loop (sync driver)

    This pattern is used in production telemetry systems when you need:
    - low websocket latency
    - high write throughput
    - predictable memory usage (bounded queue)
    """
    def __init__(
        self,
        *,
        engine: sa.Engine,
        batch_size: int,
        flush_ms: int,
        queue_maxsize: int,
        device_cache_size: int,
        source: str,
    ) -> None:
        self.engine = engine
        self.batch_size = batch_size
        self.flush_ms = flush_ms
        self.queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=queue_maxsize)
        self._task: asyncio.Task | None = None
        self._running = False

        self.device_repo = DeviceRepository(cache_size=device_cache_size)
        self.telemetry_repo = TelemetryRepository()
        self.source = source

    async def start(self) -> None:
        if self._task:
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name="telemetry-db-writer")
        log.info(
            "db_writer_started",
            batch_size=self.batch_size,
            flush_ms=self.flush_ms,
            queue_maxsize=self.queue.maxsize,
            source=self.source,
        )

    async def stop(self) -> None:
        if not self._task:
            return
        self._running = False
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            log.info("db_writer_cancelled_cleanly")
        finally:
            self._task = None
            log.info("db_writer_stopped")

    async def submit(self, event: dict[str, Any]) -> None:
        """
        Non-blocking backpressure:
        - if queue is full, we drop with a log (never block the realtime pipeline)
        """
        try:
            self.queue.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("db_queue_full_dropping_event", device_id=event.get("device_id"))

    async def _run(self) -> None:
        """
        Drain queue and flush in batches (size or time).
        """
        batch: list[dict[str, Any]] = []
        last_flush = time.monotonic()

        while self._running:
            timeout = max(0.0, (self.flush_ms / 1000.0) - (time.monotonic() - last_flush))

            try:
                event = await asyncio.wait_for(self.queue.get(), timeout=timeout)
                batch.append(event)
            except asyncio.TimeoutError:
                # time-based flush
                pass

            if not batch:
                continue

            if len(batch) >= self.batch_size or (time.monotonic() - last_flush) * 1000 >= self.flush_ms:
                to_flush = batch
                batch = []
                last_flush = time.monotonic()
                await self._flush(to_flush)

    async def _flush(self, batch: list[dict[str, Any]]) -> None:
        """
        Perform DB writes in a thread (sync driver).
        """
        started = time.perf_counter()
        try:
            written = await asyncio.to_thread(self._flush_sync, batch)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            log.info(
                "telemetry_batch_written",
                rows=written,
                batch_size=len(batch),
                elapsed_ms=elapsed_ms,
                queue_size=self.queue.qsize(),

            )
        except Exception:
            log.exception("telemetry_batch_write_failed", batch_size=len(batch), queue_size=self.queue.qsize())

    def _flush_sync(self, batch: list[dict[str, Any]]) -> int:
        """
        Sync write path:
        - groups by device_uid (device_id resolution + insert)
        - uses single connection for the flush (faster)
        """
        # Group events by device_uid (your simulator uses device_id as string uid)
        groups: dict[str, list[dict[str, Any]]] = {}
        for e in batch:
            device_uid = str(e.get("device_uid") or e.get("device_id") or "unknown")
            groups.setdefault(device_uid, []).append(e)

        total = 0
        with self.engine.begin() as conn:
            for device_uid, events in groups.items():
                device_db_id = self.device_repo.get_or_create_device_id(
                    conn,
                    device_uid=device_uid,
                    metadata=None,
                )
                total += self.telemetry_repo.insert_batch(
                    conn,
                    device_id=device_db_id,
                    events=events,
                    source=self.source,
                )
        return total
