import React, { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { addEvent } from "../../events/eventsSlice";
import { buildEvent } from "../../events/utils";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../shared/components/Card";
import { Pill } from "../../../shared/components/Pill";
import { PrimaryButton } from "../../../shared/components/PrimaryButton";
import { StatTile } from "../../../shared/components/StatTile";
import { PageShell } from "../../ui/components/PageShell";
import { appendLog, clearLog, setCommand, setConnState, toggleConnState } from "../runtimeSlice";
import type { ConnState, Stat } from "../../../shared/types/common";

export function DeviceMonitor() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const { connState, ready, command } = useAppSelector((state) => state.runtime);
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
  const logDeviceId = selectedDeviceId ?? "unassigned";
  const deviceConfigured = device?.configured ?? false;
  const logText = useAppSelector(
    (state) => state.runtime.logByDevice[logDeviceId] ?? ""
  );
  const { port, baud, parity, stopBits, dataBits, readTimeout, writeTimeout, frameFormat } =
    useAppSelector((state) => state.config);
  const displayConnState: ConnState = deviceConfigured ? connState : "Disconnected";

  const toggleConnection = async () => {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      dispatch(toggleConnState());
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

    if (connState === "Connected") {
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
        dispatch(setConnState("Disconnected"));
      }
      return;
    }

    try {
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
      dispatch(setConnState("Connected"));
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
      dispatch(setConnState("Disconnected"));
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

  const saveSessionLog = async () => {
    if (!logText.trim()) {
      dispatch(appendLog({ deviceId: logDeviceId, entry: "[Save] No log data to write" }));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "System",
            severity: "info",
            message: "Save log skipped: no data.",
            source: "system",
          })
        )
      );
      return;
    }

    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      dispatch(
        appendLog({ deviceId: logDeviceId, entry: "[Error] Log saving requires the desktop app." })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "System",
            severity: "error",
            message: "Log save failed: desktop app required.",
            source: "system",
          })
        )
      );
      return;
    }

    try {
      const path = await invoke<string>("save_session_log", { contents: logText });
      dispatch(appendLog({ deviceId: logDeviceId, entry: `[Save OK] ${path}` }));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "System",
            severity: "success",
            message: `Session log saved to ${path}`,
            source: "system",
          })
        )
      );
    } catch (error) {
      dispatch(
        appendLog({ deviceId: logDeviceId, entry: `[Error] Save failed: ${String(error)}` })
      );
      dispatch(
        addEvent(
          buildEvent({
            deviceId: logDeviceId,
            type: "System",
            severity: "error",
            message: `Session log save failed: ${String(error)}`,
            source: "system",
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

  const stats = useMemo<Stat[]>(
    () => [
      { label: "CHANNEL 1 TX", value: 0, unit: "frames" },
      { label: "CHANNEL 1 RX", value: 0, unit: "frames" },
      { label: "CHANNEL 2 TX", value: 0, unit: "frames" },
      { label: "CHANNEL 2 RX", value: 0, unit: "frames" },
      { label: "TOTAL SENT", value: 0, unit: "frames", variant: "gradient" },
      { label: "TOTAL RECEIVED", value: 0, unit: "frames", variant: "gradient" },
      { label: "SUCCESS RATE", value: "0.00", unit: "%", variant: "success" },
      { label: "ERRORS", value: 0, unit: "frames" },
      { label: "TX SPEED", value: 0, unit: "fps", variant: "gradient" },
      { label: "RX SPEED", value: 0, unit: "fps", variant: "gradient" },
    ],
    []
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
              {deviceConfigured ? (
                <PrimaryButton onClick={() => void toggleConnection()}>
                  {connState === "Connected" ? "Disconnect" : "Connect"}
                </PrimaryButton>
              ) : null}
              <PrimaryButton variant="soft" onClick={() => dispatch(clearLog(logDeviceId))}>
                Clear Log
              </PrimaryButton>
              <PrimaryButton variant="soft" onClick={() => void saveSessionLog()}>
                Save Log
              </PrimaryButton>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
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
                    "AT+PING",
                    "READ 01",
                    "READ 02",
                    "READ 03",
                    "READ 04",
                    "READ 05",
                    "WRITE 01 00",
                    "WRITE 01 01",
                    "WRITE 02 00",
                    "WRITE 02 01",
                    "SCAN",
                    "INFO",
                    "STATUS?",
                    "DIAG",
                    "FLUSH",
                    "RESET",
                    "START",
                    "STOP",
                    "SLEEP",
                    "WAKE",
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => dispatch(setCommand(label))}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Linux: /home/pi/logs/rs485.log • Windows: C:\\Logs\\rs485.log
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-neutral-950/60 p-5 ring-1 ring-white/10">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Session Log
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Latest activity stream for this device.
                </div>
              </div>
              <textarea
                value={logText}
                readOnly
                placeholder="No session data."
                className="mt-4 h-60 w-full resize-none rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
