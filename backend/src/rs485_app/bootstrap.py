from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

import sqlalchemy as sa

from rs485_app.infra.db.session import create_engine_from_settings
from rs485_app.infra.db.writer import TelemetryDbWriter
from rs485_app.infra.messaging.event_bus_inmem import InMemoryEventBus
from rs485_app.infra.rs485.simulator import TelemetrySimulator
from rs485_app.logging_config import get_logger
from rs485_app.settings import Settings

log = get_logger(__name__)


class AppRuntime:
    """
    Runtime wiring for the application.

    Responsibilities:
    - Own shared infrastructure (event bus, DB engine, DB writer)
    - Start ingestion source (simulator now, serial/wireless later)
    - Provide a single ingestion pipeline:
        ingest_event(event) -> publish realtime -> persist async (batched)

    Why this is fast:
    - WebSocket realtime path is first (lowest latency)
    - DB writes happen via a bounded queue + batching (max throughput, backpressure safe)
    - DB writes run in a thread (sync driver does not block the event loop)
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

        # Realtime fanout (WebSocket router subscribes to this)
        self.event_bus = InMemoryEventBus()

        # Background ingestion task (simulator / serial manager / wireless gateway)
        self._task: asyncio.Task | None = None

        # DB infra
        self.engine: sa.Engine | None = None
        self.db_writer: TelemetryDbWriter | None = None

    async def start(self) -> None:
        """
        Start runtime components:
        1) DB engine + DB writer (if DATABASE_URL is configured)
        2) Ingestion source (simulator for now)
        """
        # 1) Create engine (pooled connections; safe for high throughput)
        self.engine = create_engine_from_settings(self.settings)

        # 2) Start DB writer (queue + batching)
        self.db_writer = TelemetryDbWriter(
            engine=self.engine,
            batch_size=self.settings.db_write_batch_size,
            flush_ms=self.settings.db_write_flush_ms,
            queue_maxsize=self.settings.db_queue_maxsize,
            device_cache_size=self.settings.db_device_cache_size,
            source=self.settings.serial_mode,  # simulator today, serial/wireless tomorrow
        )
        await self.db_writer.start()

        # Unified pipeline for ANY ingestion source (RS-485/wireless/etc.)
        async def pipeline(event: dict[str, Any]) -> None:
            """
            High-performance telemetry pipeline:

            - Step 1 (realtime): publish immediately to event bus (lowest latency)
            - Step 2 (persistence): enqueue for DB writer (batched inserts)

            The DB enqueue is intentionally "best-effort":
            - if queue is full, DB writer logs a drop (backpressure)
            - realtime still continues (no UI freeze)
            """
            # Always push realtime first
            await self.event_bus.publish(event)

            # Persist second (batched)
            if self.db_writer is not None:
                await self.db_writer.submit(event)

        # 3) Start ingestion source (simulator now)
        if self.settings.serial_mode == "simulator":
            sim = TelemetrySimulator(
                device_id=self.settings.sim_device_id,
                interval_ms=self.settings.sim_interval_ms,
            )
            self._task = asyncio.create_task(sim.run(pipeline), name="telemetry-simulator")
            log.info("runtime_started", mode="simulator")
            return

        # Future modes: serial / wireless / mqtt / etc.
        log.warning("runtime_ingestion_mode_not_implemented_yet", mode=self.settings.serial_mode)
        log.info("runtime_started", mode=self.settings.serial_mode)

    async def stop(self) -> None:
        """
        Enterprise shutdown order (important):
        1) Stop ingestion source (simulator/serial/wireless)
        2) Stop DB writer cleanly (flush/cancel)
        3) Dispose DB engine

        Guarantees:
        - CancelledError does not bubble to FastAPI lifespan
        - DB writer doesn't block shutdown forever
        """
        log.info("runtime_stopping")

        # 1) Stop ingestion task
        if self._task:
            log.info("runtime_stopping_ingestion_task", task=str(self._task))
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                log.info("runtime_ingestion_task_cancelled_cleanly")
            except Exception:
                log.exception("runtime_ingestion_task_failed_during_shutdown")
            finally:
                self._task = None

        # 2) Stop DB writer (clean cancellation)
        if self.db_writer:
            await self.db_writer.stop()
            self.db_writer = None

        # 3) Dispose engine (close pool connections)
        if self.engine:
            try:
                self.engine.dispose()
                log.info("db_engine_disposed")
            except Exception:
                log.exception("db_engine_dispose_failed")
            finally:
                self.engine = None

        log.info("runtime_stopped")
