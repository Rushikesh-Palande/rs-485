from __future__ import annotations

import asyncio
from typing import Any

import sqlalchemy as sa

from rs485_app.infra.db.session import create_engine_from_settings
from rs485_app.infra.db.writer import TelemetryDbWriter
from rs485_app.infra.messaging.event_bus_inmem import InMemoryEventBus
from rs485_app.infra.rs485.serial_auto import resolve_serial_port
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

    Performance design:
    - WebSocket realtime fanout happens first (lowest latency)
    - DB writes happen second via bounded queue + batching (highest throughput)
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.event_bus = InMemoryEventBus()

        self._task: asyncio.Task | None = None

        self.engine: sa.Engine | None = None
        self.db_writer: TelemetryDbWriter | None = None

    async def start(self) -> None:
        # 1) Create pooled engine (fast; supports concurrency)
        self.engine = create_engine_from_settings(self.settings)

        # 2) Start DB writer (bounded queue + batching + thread offload)
        self.db_writer = TelemetryDbWriter(
            engine=self.engine,
            batch_size=self.settings.db_write_batch_size,
            flush_ms=self.settings.db_write_flush_ms,
            queue_maxsize=self.settings.db_queue_maxsize,
            device_cache_size=self.settings.db_device_cache_size,
            source=self.settings.serial_mode,
        )
        await self.db_writer.start()

        async def pipeline(event: dict[str, Any]) -> None:
            """
            Unified ingestion pipeline for any future transport (wired/wireless).

            - Step 1: publish realtime for UI
            - Step 2: enqueue persistence (batched)
            """
            await self.event_bus.publish(event)

            if self.db_writer is not None:
                await self.db_writer.submit(event)

        # 3) Ingestion source
        if self.settings.serial_mode == "simulator":
            sim = TelemetrySimulator(
                device_id=self.settings.sim_device_id,
                interval_ms=self.settings.sim_interval_ms,
            )
            self._task = asyncio.create_task(sim.run(pipeline), name="telemetry-simulator")
            log.info("runtime_started", mode="simulator")
            return

        if self.settings.serial_mode == "serial":
            try:
                port = resolve_serial_port(self.settings.serial_port)
                log.info(
                    "serial_port_resolved",
                    port=port,
                    baudrate=self.settings.serial_baudrate,
                    mode=self.settings.serial_mode,
                )
            except Exception:
                log.exception("serial_port_resolve_failed")
                raise

            # Placeholder: actual serial ingestion still needs implementation.
            log.warning("runtime_ingestion_mode_not_implemented_yet", mode="serial")
            log.info("runtime_started", mode="serial", serial_port=port)
            return

        log.warning("runtime_ingestion_mode_not_implemented_yet", mode=self.settings.serial_mode)
        log.info("runtime_started", mode=self.settings.serial_mode)

    async def stop(self) -> None:
        """
        Shutdown order:
        1) stop ingestion
        2) stop DB writer (flush/cancel)
        3) dispose engine
        """
        log.info("runtime_stopping")

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

        if self.db_writer:
            await self.db_writer.stop()
            self.db_writer = None

        if self.engine:
            try:
                self.engine.dispose()
                log.info("db_engine_disposed")
            except Exception:
                log.exception("db_engine_dispose_failed")
            finally:
                self.engine = None

        log.info("runtime_stopped")
