from __future__ import annotations

from collections.abc import Iterable, Sequence

from serial.tools import list_ports

from rs485_app.logging_config import get_logger

log = get_logger(__name__)

# Common USB-to-serial adapters seen in RS-485 dongles. Ordered by preference.
DEFAULT_VID_PID_PRIORITY: tuple[tuple[int, int], ...] = (
    (0x1A86, 0x7523),  # CH340 / CH341
    (0x10C4, 0xEA60),  # CP210x
    (0x0403, 0x6001),  # FT232 / FTDI
)


def _normalize_pref_names(preferred_names: Iterable[str] | None) -> tuple[str, ...]:
    if not preferred_names:
        return ()
    return tuple(name.lower() for name in preferred_names)


def resolve_serial_port(
    config_value: str,
    preferred_vid_pid: Sequence[tuple[int, int]] | None = None,
    preferred_name_substrings: Iterable[str] | None = None,
) -> str:
    """
    Resolve SERIAL_PORT when set to "auto".

    Strategy (in order):
    1) If the value is not "auto", return it as-is.
    2) If auto: scan ports, log what was found, then pick:
       a) First port that matches preferred VID/PID priority list
       b) First port whose description/manufacturer/product contains a preferred substring
       c) If only one port is present, use it
       d) Otherwise, fail with a clear error so the user can set SERIAL_PORT=COMx
    """
    val = (config_value or "").strip()
    pref_vid_pid = tuple(preferred_vid_pid or DEFAULT_VID_PID_PRIORITY)
    pref_names = _normalize_pref_names(preferred_name_substrings)

    if val and val.lower() != "auto":
        log.info("serial_port_configured_explicitly", port=val)
        return val

    ports = list(list_ports.comports())
    discovered = [
        {
            "device": p.device,
            "vid": p.vid,
            "pid": p.pid,
            "manufacturer": p.manufacturer,
            "product": p.product,
            "description": p.description,
            "hwid": p.hwid,
        }
        for p in ports
    ]
    log.info("serial_port_auto_scan", discovered=discovered)

    if not ports:
        msg = (
            "No serial ports found. Connect a USB RS-485 adapter or "
            "set SERIAL_PORT=COMx explicitly."
        )
        log.error("serial_port_auto_none_found")
        raise RuntimeError(msg)

    def _matches_name(port) -> bool:
        desc = " ".join(
            filter(
                None,
                [
                    str(port.device),
                    port.manufacturer or "",
                    port.product or "",
                    port.description or "",
                ],
            )
        ).lower()
        return any(name in desc for name in pref_names)

    for vid, pid in pref_vid_pid:
        for port in ports:
            if port.vid == vid and port.pid == pid:
                log.info(
                    "serial_port_resolved_auto",
                    port=port.device,
                    strategy="vid_pid",
                    vid=f"{vid:#06x}",
                    pid=f"{pid:#06x}",
                )
                return port.device

    if pref_names:
        for port in ports:
            if _matches_name(port):
                log.info(
                    "serial_port_resolved_auto",
                    port=port.device,
                    strategy="name_match",
                    names=list(pref_names),
                )
                return port.device

    if len(ports) == 1:
        port = ports[0]
        log.info("serial_port_resolved_auto_single", port=port.device)
        return port.device

    devices = [p.device for p in ports]
    log.error(
        "serial_port_auto_ambiguous",
        ports=devices,
        hint="Set SERIAL_PORT explicitly (e.g., SERIAL_PORT=COM3).",
    )
    raise RuntimeError(f"Multiple serial ports found: {devices}. Set SERIAL_PORT explicitly.")
