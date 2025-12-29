import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { addEvent } from "../../events/eventsSlice";
import { buildEvent } from "../../events/utils";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../shared/components/Card";
import { Pill } from "../../../shared/components/Pill";
import { PrimaryButton } from "../../../shared/components/PrimaryButton";
import { StatTile } from "../../../shared/components/StatTile";
import { PageShell } from "../../ui/components/PageShell";
import {
  appendLog,
  clearLog,
  setCommand,
  setConnectedDeviceId,
  setTelemetryStats,
} from "../runtimeSlice";
import type { ConnState, Stat } from "../../../shared/types/common";

type TelemetryStats = {
  ch1Tx: number;
  ch1Rx: number;
  ch2Tx: number;
  ch2Rx: number;
  totalTx: number;
  totalRx: number;
  ok: number;
  err: number;
  txFps: number;
  rxFps: number;
};

type SerialPayload = { len: number; text: string; hex: string };

const TELEMETRY_PREFIX = "@TLM";

const KEY_MAP: Record<string, keyof TelemetryStats> = {
  ch1_tx: "ch1Tx",
  ch1_rx: "ch1Rx",
  ch2_tx: "ch2Tx",
  ch2_rx: "ch2Rx",
  total_tx: "totalTx",
  total_rx: "totalRx",
  ok: "ok",
  err: "err",
  tx_fps: "txFps",
  rx_fps: "rxFps",
};

const MODBUS_REGISTER_KEYS: (keyof TelemetryStats)[] = [
  "ch1Tx",
  "ch1Rx",
  "ch2Tx",
  "ch2Rx",
  "totalTx",
  "totalRx",
  "ok",
  "err",
  "txFps",
  "rxFps",
];

function parseAsciiTelemetry(text: string): Partial<TelemetryStats> | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let line: string | undefined;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].includes(TELEMETRY_PREFIX)) {
      line = lines[i];
      break;
    }
  }
  if (!line) {
    line = lines[lines.length - 1];
  }
  if (!line) return null;

  const payload = line.includes(TELEMETRY_PREFIX)
    ? line.slice(line.indexOf(TELEMETRY_PREFIX) + TELEMETRY_PREFIX.length)
    : line;
  const parts = payload.split("|").filter(Boolean);
  const stats: Partial<TelemetryStats> = {};
  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || rawValue === undefined) continue;
    const key = rawKey.trim().toLowerCase();
    const value = Number.parseFloat(rawValue.trim());
    if (!Number.isFinite(value)) continue;
    const mapped = KEY_MAP[key];
    if (mapped) stats[mapped] = value;
  }
  return Object.keys(stats).length > 0 ? stats : null;
}

function parseHexBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((chunk) => Number.parseInt(chunk, 16))
    .filter((value) => Number.isFinite(value));
}

function parseDecimalBytes(text: string): number[] {
  return text
    .trim()
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((chunk) => Number.parseInt(chunk, 10))
    .filter((value) => Number.isFinite(value));
}

function bytesToAscii(bytes: number[]): string {
  return bytes.map((byte) => String.fromCharCode(byte)).join("");
}

function parseModbusTelemetry(bytes: number[]): Partial<TelemetryStats> | null {
  if (bytes.length < 5) return null;
  const byteCount = bytes[2];
  if (byteCount <= 0 || bytes.length < 3 + byteCount) return null;
  const data = bytes.slice(3, 3 + byteCount);
  const registers: number[] = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    registers.push((data[i] << 8) | data[i + 1]);
  }
  if (registers.length < MODBUS_REGISTER_KEYS.length) return null;
  const stats: Partial<TelemetryStats> = {};
  MODBUS_REGISTER_KEYS.forEach((key, idx) => {
    const raw = registers[idx];
    if (key === "txFps" || key === "rxFps") {
      stats[key] = raw / 100;
    } else {
      stats[key] = raw;
    }
  });
  return stats;
}

function parseTelemetry(frameFormat: string, payload: SerialPayload): Partial<TelemetryStats> | null {
  if (!payload.len) return null;
  if (frameFormat === "Modbus RTU") {
    return parseModbusTelemetry(parseHexBytes(payload.hex));
  }
  if (frameFormat === "Hex") {
    const ascii = bytesToAscii(parseHexBytes(payload.hex));
    return parseAsciiTelemetry(ascii);
  }
  if (frameFormat === "Decimal") {
    const ascii = bytesToAscii(parseDecimalBytes(payload.text));
    return parseAsciiTelemetry(ascii);
  }
  return parseAsciiTelemetry(payload.text);
}

function normalizeStats(
  current: TelemetryStats,
  incoming: Partial<TelemetryStats>
): Partial<TelemetryStats> {
  const next: TelemetryStats = { ...current, ...incoming };
  if (!incoming.totalTx && (incoming.ch1Tx || incoming.ch2Tx)) {
    next.totalTx = (incoming.ch1Tx ?? current.ch1Tx) + (incoming.ch2Tx ?? current.ch2Tx);
  }
  if (!incoming.totalRx && (incoming.ch1Rx || incoming.ch2Rx)) {
    next.totalRx = (incoming.ch1Rx ?? current.ch1Rx) + (incoming.ch2Rx ?? current.ch2Rx);
  }
  return next;
}

export function DeviceMonitor() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const { ready, command, connectedDeviceId, telemetryStats } = useAppSelector(
    (state) => state.runtime
  );
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
  const logDeviceId = selectedDeviceId ?? "unassigned";
  const deviceConfigured = device?.configured ?? false;
  const logText = useAppSelector(
    (state) => state.runtime.logByDevice[logDeviceId] ?? ""
  );
  const { port, baud, parity, stopBits, dataBits, readTimeout, writeTimeout, frameFormat } =
    useAppSelector((state) => state.config);
  const isConnected = deviceConfigured && connectedDeviceId === logDeviceId;
  const displayConnState: ConnState = isConnected ? "Connected" : "Disconnected";
  const pollRef = useRef(false);
  const statsRef = useRef(telemetryStats);
  const [showLogWindow, setShowLogWindow] = useState(false);

  const toggleConnection = async () => {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      dispatch(setConnectedDeviceId(isConnected ? null : logDeviceId));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Connection",
            severity: "info",
            message: "Connection toggled (web mode).",
            source: "system",
          })
        )
      );
      return;
    }

    if (isConnected) {
      try {
        await invoke("close_serial_port");
        dispatch(
          addEvent(
            buildEvent({
              deviceId: logDeviceId,
              type: "Connection",
              severity: "info",
              message: "Serial port closed.",
              source: "serial",
            })
          )
        );
      } catch {
        // Ignore close errors and reflect UI state.
      } finally {
        dispatch(setConnectedDeviceId(null));
      }
      return;
    }

    try {
      if (connectedDeviceId && connectedDeviceId !== logDeviceId) {
        try {
          await invoke("close_serial_port");
        } catch {
          // Ignore close errors, we'll attempt to open the new port anyway.
        } finally {
          dispatch(setConnectedDeviceId(null));
        }
      }
      await invoke("open_serial_port", {
        config: {
          port,
          baud: Number.parseInt(baud, 10),
          parity,
          stopBits,
          dataBits: Number.parseInt(dataBits, 10),
          readTimeoutMs: Number.parseInt(readTimeout, 10),
          writeTimeoutMs: Number.parseInt(writeTimeout, 10),
        },
      });
      dispatch(setConnectedDeviceId(logDeviceId));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Connection",
            severity: "success",
            message: `Serial port opened: ${port} @ ${baud}`,
            source: "serial",
          })
        )
      );
    } catch {
      dispatch(setConnectedDeviceId(null));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Connection",
            severity: "error",
            message: "Failed to open serial port.",
            source: "serial",
          })
        )
      );
    }
  };

  const sendSerialCommand = async () => {
    if (!deviceConfigured) {
      dispatch(
        appendLog({
          deviceId: logDeviceId,
          entry: "[Info] Write: Device not configured. Please configure it first.",
        })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Command",
            severity: "warning",
            message: "Write blocked: device not configured.",
            source: "command",
          })
        )
      );
      return;
    }
    if (!command.trim()) {
      return;
    }
    dispatch(appendLog({ deviceId: logDeviceId, entry: `[Send] ${command.trim()}` }));

    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      dispatch(setCommand(""));
      return;
    }

    try {
      const written = await invoke<number>("write_serial_data", {
        data: command.trim(),
        format: frameFormat === "Hex" ? "hex" : "text",
      });
      dispatch(appendLog({ deviceId: logDeviceId, entry: `[Send OK] ${written} bytes` }));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Command",
            severity: "success",
            message: `Write succeeded (${written} bytes).`,
            source: "command",
          })
        )
      );
    } catch (error) {
      const errText = String(error);
      if (errText.includes("Serial port not open")) {
        dispatch(
          appendLog({ deviceId: logDeviceId, entry: "[Error] Write failed: Serial port not open." })
        );
        dispatch(
          appendLog({ deviceId: logDeviceId, entry: "[Info] Write: Please configure the device first." })
        );
        dispatch(
          addEvent(
            buildEvent({
              deviceId: logDeviceId,
              type: "Serial",
              severity: "error",
              message: "Write failed: serial port not open.",
              source: "serial",
            })
          )
        );
      } else {
        dispatch(
          appendLog({ deviceId: logDeviceId, entry: `[Error] Write failed: ${errText}` })
        );
        dispatch(
          addEvent(
            buildEvent({
              deviceId: logDeviceId,
              type: "Serial",
              severity: "error",
              message: `Write failed: ${errText}`,
              source: "serial",
            })
          )
        );
      }
    } finally {
      dispatch(setCommand(""));
    }
  };

  const readSerialData = async () => {
    if (!deviceConfigured) {
      dispatch(
        appendLog({
          deviceId: logDeviceId,
          entry: "[Info] Read: Device not configured. Please configure it first.",
        })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Command",
            severity: "warning",
            message: "Read blocked: device not configured.",
            source: "command",
          })
        )
      );
      return;
    }
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      dispatch(
        appendLog({
          deviceId: logDeviceId,
          entry: "[Error] Serial read requires the desktop app.",
        })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "System",
            severity: "error",
            message: "Read failed: desktop app required.",
            source: "system",
          })
        )
      );
      return;
    }

    try {
      const payload = await invoke<{ len: number; text: string; hex: string }>("read_serial_data", {
        maxBytes: 1024,
      });
      if (payload.len === 0) {
        dispatch(appendLog({ deviceId: logDeviceId, entry: "[Read] No data" }));
        dispatch(
          addEvent(
            buildEvent({
              deviceId: logDeviceId,
              type: "Command",
              severity: "info",
              message: "Read completed: no data.",
              source: "command",
            })
          )
        );
        return;
      }
      const line = frameFormat === "Hex" ? payload.hex : payload.text;
      const parsed = parseTelemetry(frameFormat, payload);
      if (parsed) {
        dispatch(setTelemetryStats(normalizeStats(telemetryStats, parsed)));
      }
      dispatch(appendLog({ deviceId: logDeviceId, entry: `[Read OK] ${payload.len} bytes` }));
      dispatch(appendLog({ deviceId: logDeviceId, entry: `[Read] ${line}` }));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Command",
            severity: "success",
            message: `Read succeeded (${payload.len} bytes).`,
            source: "command",
          })
        )
      );
    } catch (error) {
      dispatch(
        appendLog({ deviceId: logDeviceId, entry: `[Error] Read failed: ${String(error)}` })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "Serial",
            severity: "error",
            message: `Read failed: ${String(error)}`,
            source: "serial",
          })
        )
      );
    }
  };

  useEffect(() => {
    statsRef.current = telemetryStats;
  }, [telemetryStats]);

  useEffect(() => {
    if (!logDeviceId) return;
    try {
      localStorage.setItem(`session-log:${logDeviceId}`, logText);
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [logDeviceId, logText]);

  useEffect(() => {
    const key = `session-log-clear:${logDeviceId}`;
    const handler = (event: StorageEvent) => {
      if (event.key !== key) return;
      dispatch(clearLog(logDeviceId));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [dispatch, logDeviceId]);

  useEffect(() => {
    if (!isConnected || !deviceConfigured) {
      return undefined;
    }
    let cancelled = false;
    pollRef.current = false;

    const intervalId = window.setInterval(async () => {
      if (cancelled || pollRef.current) return;
      pollRef.current = true;
      try {
        const { isTauri, invoke } = await import("@tauri-apps/api/core");
        if (!isTauri()) return;
        const payload = await invoke<SerialPayload>("read_serial_data", { maxBytes: 1024 });
        if (!payload.len) return;
        const parsed = parseTelemetry(frameFormat, payload);
        if (parsed) {
          dispatch(setTelemetryStats(normalizeStats(statsRef.current, parsed)));
        }
      } catch {
        // Ignore background read failures to avoid spamming UI.
      } finally {
        pollRef.current = false;
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [dispatch, deviceConfigured, frameFormat, isConnected]);

  useEffect(() => {
    return () => {
      if (!showLogWindow) return;
      const label = `session-log-${logDeviceId}`;
      void (async () => {
        const { isTauri } = await import("@tauri-apps/api/core");
        if (!isTauri()) return;
        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const existing = await WebviewWindow.getByLabel(label);
        if (existing) {
          await existing.close();
        }
      })();
    };
  }, [logDeviceId, showLogWindow]);

  const stats = useMemo<Stat[]>(
    () => {
      const ok = telemetryStats.ok;
      const err = telemetryStats.err;
      const successRate = ok + err > 0 ? (ok / (ok + err)) * 100 : 0;
      return [
        { label: "CHANNEL 1 TX", value: telemetryStats.ch1Tx, unit: "frames" },
        { label: "CHANNEL 1 RX", value: telemetryStats.ch1Rx, unit: "frames" },
        { label: "CHANNEL 2 TX", value: telemetryStats.ch2Tx, unit: "frames" },
        { label: "CHANNEL 2 RX", value: telemetryStats.ch2Rx, unit: "frames" },
        { label: "TOTAL SENT", value: telemetryStats.totalTx, unit: "frames", variant: "gradient" },
        {
          label: "TOTAL RECEIVED",
          value: telemetryStats.totalRx,
          unit: "frames",
          variant: "gradient",
        },
        {
          label: "SUCCESS RATE",
          value: successRate.toFixed(2),
          unit: "%",
          variant: "success",
        },
        { label: "ERRORS", value: telemetryStats.err, unit: "frames" },
        { label: "TX SPEED", value: telemetryStats.txFps, unit: "fps", variant: "gradient" },
        { label: "RX SPEED", value: telemetryStats.rxFps, unit: "fps", variant: "gradient" },
      ];
    },
    [telemetryStats]
  );

  return (
    <PageShell
      pageTitle="Device Monitor"
      subtitle={device ? `Monitoring ${device.name}` : "Manage and monitor multiple devices"}
      statusLeft={
        <Pill tone={displayConnState === "Disconnected" ? "danger" : "success"}>
          {device?.name ?? "Device 1"}
        </Pill>
      }
      statusRight={
        <div className="flex items-center gap-3">
          <Pill tone={displayConnState === "Disconnected" ? "danger" : "success"}>
            {displayConnState}
          </Pill>
          <Pill tone={ready ? "neutral" : "neutral"}>Ready</Pill>
        </div>
      }
      right={
        <PrimaryButton
          variant="soft"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/devices")}
        >
          Back to Devices
        </PrimaryButton>
      }
    >
      <Card title="Real-Time Statistics">
        <div className="grid gap-4 md:grid-cols-5">
          {stats.slice(0, 5).map((s) => (
            <StatTile key={s.label} stat={s} />
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          {stats.slice(5).map((s) => (
            <StatTile key={s.label} stat={s} />
          ))}
        </div>
      </Card>

      <Card title="Commands & Controls" className="bg-transparent p-0 shadow-none border-0">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-950/50 px-4 py-3">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                Session Controls
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Connect, clear, or save the current device session.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {device ? (
                <PrimaryButton
                  variant="soft"
                  onClick={() => navigate(`/devices/${device.id}/config`)}
                >
                  Configure
                </PrimaryButton>
              ) : null}
              {deviceConfigured ? (
                <PrimaryButton onClick={() => void toggleConnection()}>
                  {isConnected ? "Disconnect" : "Connect"}
                </PrimaryButton>
              ) : null}
            </div>
          </div>
          <div
            className={`grid gap-4 ${
              showLogWindow ? "md:grid-cols-1" : "md:grid-cols-[2.1fr_1fr]"
            }`}
          >
            <div className="rounded-xl bg-neutral-950/60 p-5 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                    Command Entry
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Send immediate commands or read the current buffer.
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  value={command}
                  onChange={(e) => dispatch(setCommand(e.target.value))}
                  placeholder="Enter command…"
                  className="h-11 flex-1 rounded-lg bg-neutral-950/70 px-3 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <PrimaryButton onClick={() => void sendSerialCommand()}>Send</PrimaryButton>
                  <PrimaryButton variant="soft" onClick={() => void readSerialData()}>
                    Read
                  </PrimaryButton>
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Preset Commands
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    {
                      label: "ASCII: @TLM sample",
                      value:
                        "@TLM|ch1_tx=12|ch1_rx=10|ch2_tx=8|ch2_rx=9|total_tx=20|total_rx=19|ok=19|err=1|tx_fps=5.2|rx_fps=4.8",
                    },
                    {
                      label: "HEX: @TLM sample",
                      value:
                        "40 54 4C 4D 7C 63 68 31 5F 74 78 3D 31 32 7C 63 68 31 5F 72 78 3D 31 30 7C 63 68 32 5F 74 78 3D 38 7C 63 68 32 5F 72 78 3D 39 7C 74 6F 74 61 6C 5F 74 78 3D 32 30 7C 74 6F 74 61 6C 5F 72 78 3D 31 39 7C 6F 6B 3D 31 39 7C 65 72 72 3D 31 7C 74 78 5F 66 70 73 3D 35 2E 32 7C 72 78 5F 66 70 73 3D 34 2E 38",
                    },
                    {
                      label: "DECIMAL: @TLM sample",
                      value:
                        "64 84 76 77 124 99 104 49 95 116 120 61 49 50 124 99 104 49 95 114 120 61 49 48 124 99 104 50 95 116 120 61 56 124 99 104 50 95 114 120 61 57 124 116 111 116 97 108 95 116 120 61 50 48 124 116 111 116 97 108 95 114 120 61 49 57 124 111 107 61 49 57 124 101 114 114 61 49 124 116 120 95 102 112 115 61 53 46 50 124 114 120 95 102 112 115 61 52 46 56",
                    },
                    {
                      label: "MODBUS RTU: sample registers",
                      value:
                        "01 03 14 00 0C 00 0A 00 08 00 09 00 14 00 13 00 13 00 01 02 08 01 E0",
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => dispatch(setCommand(preset.value))}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Linux: /home/pi/logs/rs485.log • Windows: C:\\Logs\\rs485.log
                </div>
              </div>
            </div>

            {!showLogWindow ? (
              <div className="rounded-xl bg-neutral-950/60 p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                      Session Log
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Latest activity stream for this device.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-slate-100"
                    onClick={async () => {
                      try {
                        const { isTauri } = await import("@tauri-apps/api/core");
                        if (!isTauri()) return;
                        const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
                        const label = `session-log-${logDeviceId}`;
                        const existing = await WebviewWindow.getByLabel(label);
                        if (existing) {
                          await existing.show();
                          await existing.setFocus();
                          setShowLogWindow(true);
                          return;
                        }
                        const win = new WebviewWindow(label, {
                          url: `/session-log?deviceId=${encodeURIComponent(logDeviceId)}`,
                          title: `Session Log (${logDeviceId})`,
                          width: 900,
                          height: 700,
                          resizable: true,
                        });
                        win.once("tauri://created", async () => {
                          setShowLogWindow(true);
                          try {
                            await win.show();
                            await win.setFocus();
                          } catch {
                            // Ignore focus errors.
                          }
                        });
                        win.once("tauri://error", () => {
                          setShowLogWindow(false);
                        });
                        win.onCloseRequested(() => {
                          setShowLogWindow(false);
                        });
                        setTimeout(async () => {
                          try {
                            const verify = await WebviewWindow.getByLabel(label);
                            if (!verify) {
                              setShowLogWindow(false);
                            }
                          } catch {
                            setShowLogWindow(false);
                          }
                        }, 300);
                      } catch {}
                    }}
                  >
                    <Maximize2 className="h-4 w-4" />
                    Expand
                  </button>
                </div>
                <textarea
                  value={logText}
                  readOnly
                  placeholder="No session data."
                  className="mt-4 h-60 w-full resize-none rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 focus:outline-none font-mono"
                />
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
