from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from rs485_app.infra.messaging.event_bus_inmem import InMemoryEventBus
from rs485_app.logging_config import (
    RequestContext,
    bind_ws_context,
    clear_request_context,
    get_logger,
    new_request_id,
)

router = APIRouter(tags=["realtime"])
log = get_logger(__name__)


@router.websocket("/ws/realtime")
async def ws_realtime(websocket: WebSocket) -> None:
    """
    Realtime WebSocket:
    ✅ binds ws_request_id, ws_client_id, ws_path into contextvars
       so every WS log line includes them automatically.
    """
    # Extract request/correlation from headers (if client sends them).
    headers = dict(websocket.headers)
    request_id, _correlation_id = RequestContext.extract_ids(headers)

    # Stable WS identifiers
    ws_request_id = request_id or new_request_id()
    ws_client_id = f"ws-{id(websocket)}"
    ws_path = str(websocket.url.path)

    # Optional future: allow UI to filter by device_id (query param)
    device_id = websocket.query_params.get("device_id")

    bind_ws_context(
        ws_request_id=ws_request_id,
        ws_client_id=ws_client_id,
        ws_path=ws_path,
        device_id=device_id,
    )

    await websocket.accept()

    bus: InMemoryEventBus = websocket.app.state.event_bus
    queue: asyncio.Queue[dict[str, Any]] = bus.subscribe()

    log.info("ws_connected")

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        log.info("ws_disconnected")
    except Exception:
        log.exception("ws_error")
        raise
    finally:
        bus.unsubscribe(queue)
        clear_request_context()  # prevent context leaks across connections
