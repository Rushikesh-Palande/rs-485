import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  Settings,
  Plus,
  ArrowLeft,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import type { AppEvent, ConnState, EventSeverity, PillTone, Stat } from "../app/types";
import { setNav, setDeviceView, toggleSidebar } from "../app/slices/uiSlice";
import { addDevice, removeDevice, setDeviceConfigured, setSelectedDeviceId } from "../app/slices/devicesSlice";
import { addEvent } from "../app/slices/eventsSlice";
import {
  setBaud,
  setFrameFormat,
  setModbusEnabled,
  setParity,
  setPort,
  setReadTimeout,
  setStopBits,
  setWriteTimeout,
} from "../app/slices/configSlice";
import {
  appendLog,
  clearLog,
  setCommand,
  setConnState,
  toggleConnState,
} from "../app/slices/runtimeSlice";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function buildEvent(payload: Omit<AppEvent, "id" | "ts">): AppEvent {
  return {
    ...payload,
    id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: new Date().toISOString(),
  };
}

function Pill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
      : tone === "success"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
      : "bg-white/10 text-slate-200 ring-white/15";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        styles
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  active,
  icon,
  label,
  onClick,
  showLabel,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  showLabel?: boolean;
}) {
  const base = "group relative flex items-center transition";
  const layout = showLabel
    ? "h-10 w-full justify-start gap-3 rounded-lg px-3"
    : "h-12 w-12 justify-center rounded-xl";
  return (
    <button
      onClick={onClick}
      className={cn(
        base,
        layout,
        active
          ? "bg-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          : "hover:bg-white/10"
      )}
      aria-label={label}
      title={label}
      type="button"
    >
      <span className={cn(active ? "text-white" : "text-white/80 group-hover:text-white")}>{icon}</span>
      {showLabel ? (
        <span className={cn("text-xs font-semibold tracking-wide", active ? "text-white" : "text-white/80")}>
          {label}
        </span>
      ) : null}
    </button>
  );
}

function Card({
  title,
  right,
  className,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-neutral-900/80 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10",
        className
      )}
    >
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between">
          {title ? (
            <div className="text-sm font-semibold text-slate-100">{title}</div>
          ) : (
            <div />
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  variant = "solid",
  icon,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "solid" | "soft";
  icon?: React.ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-400/50";

  const styles =
    variant === "soft"
      ? "bg-white/10 text-slate-100 hover:bg-white/15"
      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        base,
        styles,
        disabled &&
          "cursor-not-allowed opacity-60 shadow-none hover:brightness-100",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
  stacked,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label?: string;
  className?: string;
  disabled?: boolean;
  stacked?: boolean;
}) {
  return (
    <label
      className={cn(
        stacked ? "flex flex-col items-start gap-2" : "flex items-center gap-2",
        className
      )}
    >
      {label ? (
        <span
          className={cn(
            "text-xs font-semibold text-slate-300",
            stacked ? "min-w-0" : "min-w-[120px]"
          )}
        >
          {label}
        </span>
      ) : null}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 appearance-none rounded-lg bg-neutral-950/70 px-3 pr-9 text-sm font-medium text-slate-100 ring-1 ring-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

function StatTile({ stat }: { stat: Stat }) {
  const variant = stat.variant ?? "soft";
  const cls =
    variant === "success"
      ? "bg-emerald-500 text-white"
    : variant === "gradient"
      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
      : "bg-neutral-950 text-slate-100";

  return (
    <div
      className={cn(
        "rounded-lg p-4 ring-1 ring-white/10 shadow-sm",
        cls
      )}
    >
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          variant === "soft" ? "text-slate-400" : "text-white/85"
        )}
      >
        {stat.label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className={cn("text-3xl font-extrabold", variant === "soft" ? "text-slate-100" : "text-white")}>{stat.value}</div>
        {stat.unit ? (
          <div
            className={cn(
              "pb-1 text-xs font-semibold",
              variant === "soft" ? "text-slate-400" : "text-white/85"
            )}
          >
            {stat.unit}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PageShell({
  pageTitle,
  subtitle,
  statusLeft,
  statusRight,
  right,
  children,
}: {
  pageTitle: string;
  subtitle?: string;
  statusLeft?: React.ReactNode;
  statusRight?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-slate-100">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen px-10 py-10 transition-[padding] duration-200",
          sidebarOpen ? "pl-[220px]" : "pl-[72px]"
        )}
      >
        <div className="w-full">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
                {pageTitle}
              </h1>
              {subtitle ? (
                <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
              ) : null}
              <div className="mt-4 flex items-center gap-3">
                {statusLeft}
                {statusRight}
              </div>
            </div>
            {right}
          </div>

          <div className="mt-8 space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  const dispatch = useAppDispatch();
  const nav = useAppSelector((state) => state.ui.nav);
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen border-r border-white/10 bg-neutral-900 transition-[width] duration-200",
        sidebarOpen ? "w-[220px]" : "w-[72px]"
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col py-6",
          sidebarOpen ? "items-stretch px-2" : "items-center"
        )}
      >
        <div className={cn("flex flex-1 flex-col gap-3", sidebarOpen ? "items-stretch" : "items-center")}>
          <IconButton
            active={nav === "dash"}
            onClick={() => dispatch(setNav("dash"))}
            label="DEVICES"
            icon={<LayoutDashboard className="h-5 w-5" />}
            showLabel={sidebarOpen}
          />
          <IconButton
            active={nav === "events"}
            onClick={() => dispatch(setNav("events"))}
            label="EVENTS"
            icon={<Bell className="h-5 w-5" />}
            showLabel={sidebarOpen}
          />
        </div>

        <div className={cn("mt-4 flex flex-col gap-3", sidebarOpen ? "items-stretch" : "items-center")} />
      </div>
    </aside>
  );
}

function DeviceConfiguration() {
  const dispatch = useAppDispatch();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
  const { connState, ready, rawData, parsedData, errors, command, logText } =
    useAppSelector((state) => state.runtime);
  const {
    port,
    baud,
    parity,
    stopBits,
    dataBits,
    readTimeout,
    writeTimeout,
    frameFormat,
    modbusEnabled,
  } = useAppSelector((state) => state.config);
  const [detectedPorts, setDetectedPorts] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [saveToast, setSaveToast] = useState<{ tone: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!saveToast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setSaveToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [saveToast]);

  const applySerialConfig = async () => {
    const { isTauri, invoke } = await import("@tauri-apps/api/core");
    if (!isTauri()) {
      setSaveToast({ tone: "error", message: "Serial configuration requires the desktop app." });
      dispatch(
        addEvent(
          buildEvent({
            deviceId: device?.id ?? null,
            type: "Config",
            severity: "error",
            message: "Config save failed: desktop app required.",
            source: "config",
          })
        )
      );
      return;
    }

    try {
      const status = await invoke<{
        port: string;
        baud: number;
        parity: string;
        stopBits: string;
        dataBits: number;
        timeoutMs: number;
      }>("open_serial_port", {
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
      if (device) {
        dispatch(setDeviceConfigured({ id: device.id, configured: true }));
      }
      dispatch(
        addEvent(
          buildEvent({
            deviceId: device?.id ?? null,
            type: "Config",
            severity: "success",
            message: `Config saved: ${status.port} @ ${status.baud}`,
            source: "config",
          })
        )
      );
      setSaveToast({
        tone: "success",
        message: `Saved: ${status.port} @${status.baud} (${status.parity}, ${status.stopBits}, ${status.dataBits}b)`,
      });
    } catch {
      dispatch(setConnState("Disconnected"));
      dispatch(
        addEvent(
          buildEvent({
            deviceId: device?.id ?? null,
            type: "Config",
            severity: "error",
            message: "Config save failed.",
            source: "config",
          })
        )
      );
      setSaveToast({ tone: "error", message: "Failed to apply serial configuration." });
    }
  };

  const detectPorts = useCallback(
    async (currentPort: string) => {
    setIsDetecting(true);
    try {
      const { invoke, isTauri } = await import("@tauri-apps/api/core");
      if (!isTauri()) {
        setDetectedPorts([]);
        return;
      }
      const ports = await invoke<string[]>("list_serial_ports");
      const resolvedPorts = ports ?? [];
      setDetectedPorts(resolvedPorts);
      if (resolvedPorts.length > 0 && currentPort.trim() === "") {
        dispatch(setPort(resolvedPorts[0]));
      }
    } catch {
      setDetectedPorts([]);
    } finally {
      setIsDetecting(false);
    }
  },
    [dispatch]
  );


  return (
    <PageShell
      pageTitle="Device Configuration"
      subtitle={device ? `Device: ${device.name} (${device.id})` : "No device selected"}
      statusLeft={<Pill tone={connState === "Disconnected" ? "danger" : "success"}>{connState}</Pill>}
      statusRight={<Pill tone="neutral">Ready</Pill>}
      right={
        <PrimaryButton
          variant="soft"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => dispatch(setNav("dash"))}
        >
          Back to Devices
        </PrimaryButton>
      }
    >
      <Card
        title="Communication Parameters"
        right={
          <PrimaryButton variant="soft" onClick={() => void applySerialConfig()}>
            Save
          </PrimaryButton>
        }
        className="relative"
      >
        {saveToast ? (
          <div
            className={cn(
              "fixed right-6 top-6 z-50 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg ring-1",
              saveToast.tone === "success"
                ? "bg-emerald-500/15 ring-emerald-500/30"
                : "bg-rose-500/15 text-rose-200 ring-rose-500/30"
            )}
          >
            {saveToast.message}
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">Line Settings</div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <span className="min-w-[120px] text-xs font-semibold text-slate-300">Port:</span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="relative flex-1">
                      <select
                        value={port}
                        onChange={(e) => dispatch(setPort(e.target.value))}
                        disabled={detectedPorts.length === 0}
                        className="h-9 w-full appearance-none rounded-lg bg-neutral-950/70 px-3 pr-9 text-sm font-medium text-slate-100 ring-1 ring-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                      >
                        {detectedPorts.length === 0 ? (
                          <option value="">No ports detected</option>
                        ) : null}
                        {!detectedPorts.includes(port) && port ? (
                          <option value={port}>{port}</option>
                        ) : null}
                        {detectedPorts.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => detectPorts(port)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10"
                      disabled={isDetecting}
                      title={isDetecting ? "Detecting ports" : "Detect ports"}
                      aria-label="Detect ports"
                    >
                      <RefreshCw className={cn("h-4 w-4", isDetecting && "animate-spin")} />
                    </button>
                  </div>
                </label>
                <Select
                  label="Baud Rate:"
                  value={baud}
                  onChange={(value) => dispatch(setBaud(value))}
                  options={["9600", "19200", "57600", "115200"]}
                  className="w-full"
                />
                <Select
                  label="Parity:"
                  value={parity}
                  onChange={(value) => dispatch(setParity(value))}
                  options={["None", "Even", "Odd"]}
                  className="w-full"
                />
              </div>
              <div className="space-y-3">
                <Select
                  label="Stop Bits:"
                  value={stopBits}
                  onChange={(value) => dispatch(setStopBits(value))}
                  options={["1", "2"]}
                  className="w-full"
                />
                <Select
                  label="Data Bits:"
                  value={dataBits}
                  onChange={() => {}}
                  options={["8"]}
                  disabled
                  className="w-full"
                />
                <Select
                  label="Frame Format:"
                  value={frameFormat}
                  onChange={(value) => dispatch(setFrameFormat(value))}
                  options={["ASCII", "Hex", "Modbus RTU"]}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">Timeouts & Parser</div>
            <div className="mt-3 space-y-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300">Read Timeout (ms)</span>
                <input
                  value={readTimeout}
                  onChange={(e) => dispatch(setReadTimeout(e.target.value))}
                  className="h-9 w-24 rounded-lg bg-neutral-950/70 px-3 text-sm font-medium text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300">Write Timeout (ms)</span>
                <input
                  value={writeTimeout}
                  onChange={(e) => dispatch(setWriteTimeout(e.target.value))}
                  className="h-9 w-24 rounded-lg bg-neutral-950/70 px-3 text-sm font-medium text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modbusEnabled}
                  onChange={(e) => dispatch(setModbusEnabled(e.target.checked))}
                  className="h-4 w-4 rounded border-white/20 bg-neutral-950/70"
                />
                <span className="text-xs font-semibold text-slate-300">Enable Modbus RTU parser</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Status Strip">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={connState === "Disconnected" ? "danger" : "success"}>{connState}</Pill>
          <Pill tone="neutral">{port}</Pill>
          <Pill tone="neutral">{baud} bps</Pill>
          <Pill tone="neutral">Parity: {parity}</Pill>
          <Pill tone="neutral">Stop: {stopBits}</Pill>
          <Pill tone={errors === "None" ? "neutral" : "danger"}>{errors}</Pill>
        </div>
      </Card>

      <Card title="Status & Live Data">

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">RAW RECEIVED</div>
            <div className="mt-3 min-h-[120px] rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 ring-1 ring-white/10">
              {rawData}
            </div>
          </div>
          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">PARSED DATA</div>
            <div className="mt-3 min-h-[120px] rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 ring-1 ring-white/10">
              {parsedData}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Device Actions">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            Remove this device from the list. This does not delete backend data.
          </div>
          <PrimaryButton
            variant="soft"
            disabled={!device}
            className="hover:bg-rose-500/20 hover:text-rose-200"
            onClick={() => {
              if (!device) return;
              dispatch(removeDevice(device.id));
              dispatch(
                addEvent(
                  buildEvent({
                    deviceId: device.id,
                    type: "Device",
                    severity: "warning",
                    message: `Device removed (${device.id}).`,
                    source: "device",
                  })
                )
              );
              dispatch(setNav("dash"));
            }}
          >
            Remove Device
          </PrimaryButton>
        </div>
      </Card>
    </PageShell>
  );
}

function DeviceManagement() {
  const dispatch = useAppDispatch();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const { connState, ready, command } = useAppSelector((state) => state.runtime);
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
  const logDeviceId = selectedDeviceId ?? "unassigned";
  const deviceConfigured = device?.configured ?? false;
  const logText = useAppSelector(
    (state) => state.runtime.logByDevice[logDeviceId] ?? ""
  );
  const displayConnState: ConnState = deviceConfigured ? connState : "Disconnected";
  const { port, baud, parity, stopBits, dataBits, readTimeout, writeTimeout, frameFormat } =
    useAppSelector((state) => state.config);

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
      statusLeft={<Pill tone={connState === "Disconnected" ? "danger" : "success"}>{device?.name ?? "Device 1"}</Pill>}
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
          onClick={() => dispatch(setNav("dash"))}
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

      <Card
        title="Commands & Controls"
        className="bg-transparent p-0 shadow-none border-0"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-neutral-950/50 px-4 py-3 ">
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
                  <PrimaryButton onClick={() => void sendSerialCommand()}>
                    Send
                  </PrimaryButton>
                  <PrimaryButton
                    variant="soft"
                    onClick={() => void readSerialData()}
                  >
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
                    "WRITE 01 00",
                    "WRITE 01 01",
                    "STATUS?",
                    "DIAG",
                    "FLUSH",
                    "RESET",
                    "START",
                    "STOP",
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
                className="mt-4 h-60 w-full resize-none rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 ring-1 ring-white/10 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </Card>

    </PageShell>
  );
}

function DevicesPage() {
  const dispatch = useAppDispatch();
  const devices = useAppSelector((state) => state.devices.devices);
  const selectedDeviceId = useAppSelector((state) => state.devices.selectedDeviceId);
  const connState = useAppSelector((state) => state.runtime.connState);
  const nextDeviceId = `DEV-${String(devices.length + 1).padStart(3, "0")}`;

  return (
    <PageShell
      pageTitle="Devices"
      subtitle="Add and configure your devices"
      statusLeft={<Pill tone="neutral">Fleet</Pill>}
      right={
        <div className="flex items-center gap-3">
          <PrimaryButton
            onClick={() => {
              dispatch(addDevice());
              dispatch(
                addEvent(
                  buildEvent({
                    deviceId: nextDeviceId,
                    type: "Device",
                    severity: "success",
                    message: `Device added (${nextDeviceId}).`,
                    source: "device",
                  })
                )
              );
            }}
            variant="soft"
            icon={<Plus className="h-4 w-4" />}
          >
            Add Device
          </PrimaryButton>
        </div>
      }
    >
      <Card title="Registered Devices">
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => {
            const isSelected = device.id === selectedDeviceId;
            const status =
              isSelected && connState === "Connected" && device.configured
                ? "Connected"
                : "Disconnected";
            return (
              <div
                key={device.id}
                className="rounded-lg bg-neutral-950/60 p-5 ring-1 ring-white/10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-100">{device.name}</div>
                    <div className="text-xs text-slate-400">{device.id}</div>
                  </div>
                  <Pill tone={status === "Connected" ? "success" : "danger"}>
                    {status}
                  </Pill>
                </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Connection</div>
                  <div className="text-sm font-semibold text-slate-200">{device.connection}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last Seen</div>
                  <div className="text-sm font-semibold text-slate-200">{device.lastSeen}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <PrimaryButton
                  onClick={() => {
                    dispatch(setSelectedDeviceId(device.id));
                    dispatch(setNav("config"));
                    dispatch(setDeviceView("config"));
                  }}
                  icon={<Settings className="h-4 w-4" />}
                >
                  Configure
                </PrimaryButton>
                <PrimaryButton
                  variant="soft"
                  onClick={() => {
                    dispatch(setSelectedDeviceId(device.id));
                    dispatch(setNav("config"));
                    dispatch(setDeviceView("management"));
                  }}
                  icon={<Activity className="h-4 w-4" />}
                >
                  Monitor
                </PrimaryButton>
              </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageShell>
  );
}

function EventsPage() {
  const devices = useAppSelector((state) => state.devices.devices);
  const events = useAppSelector((state) => state.events.items);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [deviceFilter, setDeviceFilter] = useState("All");
  const [rangeFilter, setRangeFilter] = useState("24h");

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((evt) => {
      if (severityFilter !== "All" && evt.severity !== severityFilter) return false;
      if (typeFilter !== "All" && evt.type !== typeFilter) return false;
      if (deviceFilter !== "All" && evt.deviceId !== deviceFilter) return false;
      if (rangeFilter !== "All") {
        const ts = new Date(evt.ts).getTime();
        const delta = now - ts;
        const limit =
          rangeFilter === "1h"
            ? 60 * 60 * 1000
            : rangeFilter === "6h"
              ? 6 * 60 * 60 * 1000
              : rangeFilter === "24h"
                ? 24 * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000;
        if (delta > limit) return false;
      }
      return true;
    });
  }, [deviceFilter, events, rangeFilter, severityFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = filteredEvents.length;
    const errors = filteredEvents.filter((evt) => evt.severity === "error").length;
    const warnings = filteredEvents.filter((evt) => evt.severity === "warning").length;
    const commands = filteredEvents.filter((evt) => evt.type === "Command").length;
    return { total, errors, warnings, commands };
  }, [filteredEvents]);

  const severityTone = (severity: EventSeverity): PillTone => {
    if (severity === "error") return "danger";
    if (severity === "warning") return "danger";
    if (severity === "success") return "success";
    return "neutral";
  };

  return (
    <PageShell pageTitle="Events" subtitle="Operational history and alerts">
      <Card title="Overview">
        <div className="grid gap-4 md:grid-cols-4">
          <StatTile stat={{ label: "TOTAL EVENTS", value: stats.total }} />
          <StatTile stat={{ label: "ERRORS", value: stats.errors, variant: "gradient" }} />
          <StatTile stat={{ label: "WARNINGS", value: stats.warnings }} />
          <StatTile stat={{ label: "COMMANDS", value: stats.commands, variant: "success" }} />
        </div>
      </Card>

      <Card>
        <div className="grid gap-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="Severity"
            value={severityFilter}
            onChange={(value) => setSeverityFilter(value)}
            options={["All", "info", "success", "warning", "error"]}
            className="w-full"
            stacked
          />
          <Select
            label="Type"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value)}
            options={[
              "All",
              "Connection",
              "Command",
              "Serial",
              "Config",
              "Device",
              "System",
            ]}
            className="w-full"
            stacked
          />
          <Select
            label="Device"
            value={deviceFilter}
            onChange={(value) => setDeviceFilter(value)}
            options={["All", ...devices.map((device) => device.id)]}
            className="w-full"
            stacked
          />
          <Select
            label="Range"
            value={rangeFilter}
            onChange={(value) => setRangeFilter(value)}
            options={["1h", "6h", "24h", "7d", "All"]}
            className="w-full"
            stacked
          />
        </div>
      </Card>

      <Card title={`Events (${filteredEvents.length})`}>
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-sm text-slate-400">No events match the current filters.</div>
          ) : (
            filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="rounded-lg bg-neutral-950/60 p-4 transition hover:bg-neutral-900/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={severityTone(evt.severity)}>{evt.severity.toUpperCase()}</Pill>
                    <span className="text-xs font-semibold text-slate-300">{evt.type}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      {evt.deviceId ?? "System"}
                    </span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400">
                      {new Date(evt.ts).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{evt.source}</div>
                </div>
                <div className="mt-2 text-sm text-slate-200">{evt.message}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PageShell>
  );
}

export default function Dashboard() {
  const nav = useAppSelector((state) => state.ui.nav);
  const deviceView = useAppSelector((state) => state.ui.deviceView);

  return (
    <>
      {nav === "config" ? (
        deviceView === "config" ? (
          <DeviceConfiguration />
        ) : (
          <DeviceManagement />
        )
      ) : nav === "dash" ? (
        <DevicesPage />
      ) : (
        <EventsPage />
      )}
    </>
  );
}
