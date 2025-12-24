from __future__ import annotations

import asyncio
import math
import random
from datetime import UTC, datetime

from rs485_app.logging_config import get_logger

log = get_logger(__name__)


class TelemetrySimulator:
    """
    Generates realistic telemetry signals so frontend can be built immediately.
    """

    def __init__(self, device_id: str, interval_ms: int) -> None:
        self.device_id = device_id
        self.interval_ms = interval_ms
        self._t = 0.0
        self._running = False

    async def run(self, publish_cb) -> None:
        """
        publish_cb: async callable(event_dict)
        """
        self._running = True
        log.info("simulator_started", device_id=self.device_id, interval_ms=self.interval_ms)

        try:
            while self._running:
                self._t += 0.08

                voltage = 12.0 + 0.6 * math.sin(self._t) + random.uniform(-0.08, 0.08)
                current = 1.5 + 0.4 * math.sin(self._t * 0.7) + random.uniform(-0.05, 0.05)
                temp_c = 35.0 + 2.0 * math.sin(self._t * 0.3) + random.uniform(-0.2, 0.2)
                rpm = 1400 + 120 * math.sin(self._t * 0.9) + random.uniform(-10, 10)

                event = {
                    "ts": datetime.now(UTC).isoformat(),
                    "device_id": self.device_id,
                    "metrics": {
                        "voltage": round(voltage, 3),
                        "current": round(current, 3),
                        "temp_c": round(temp_c, 3),
                        "rpm": round(rpm, 1),
                    },
                    "quality": {"crc_ok": True, "frame_seq": int(self._t * 1000)},
                }

                await publish_cb(event)
                await asyncio.sleep(self.interval_ms / 1000.0)

        except asyncio.CancelledError:
            log.info("simulator_cancelled", device_id=self.device_id)
            raise
        except Exception:
            log.exception("simulator_failed", device_id=self.device_id)
            raise
        finally:
            log.info("simulator_stopped", device_id=self.device_id)

    def stop(self) -> None:
        self._running = False
