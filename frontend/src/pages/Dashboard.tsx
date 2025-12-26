import React, { useMemo } from "react";
import {
  LayoutDashboard,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  Play,
  Pause,
  ChevronDown,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import type { PillTone, Stat } from "../app/types";
import { setNav, setDeviceView, toggleSidebar } from "../app/slices/uiSlice";
import { addDevice, setSelectedDeviceId } from "../app/slices/devicesSlice";
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
  toggleConnState,
} from "../app/slices/runtimeSlice";
import { setGraphMode, toggleRunning } from "../app/slices/managementSlice";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-neutral-900/80 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
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
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "solid" | "soft";
  icon?: React.ReactNode;
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
          "cursor-not-allowed opacity-60 shadow-none hover:brightness-100"
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
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-2", className)}>
      {label ? (
        <span className="min-w-[120px] text-xs font-semibold text-slate-300">{label}</span>
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
        "fixed left-0 top-0 h-screen bg-neutral-900 transition-[width] duration-200",
        sidebarOpen ? "w-[220px]" : "w-[72px]"
      )}
    >
      <div
        className={cn(
          "flex h-full flex-col py-6",
          sidebarOpen ? "items-stretch px-2" : "items-center"
        )}
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
          <span className="text-xs font-black tracking-widest">UI</span>
        </div>

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

        <div className={cn("mt-4 flex flex-col gap-3", sidebarOpen ? "items-stretch" : "items-center")}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-slate-200 hover:bg-white/10"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={() => dispatch(toggleSidebar())}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
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

  return (
    <PageShell
      pageTitle="Device Configuration"
      subtitle={device ? `Device: ${device.name} (${device.id})` : "No device selected"}
      statusLeft={<Pill tone={connState === "Disconnected" ? "danger" : "success"}>{connState}</Pill>}
      statusRight={<Pill tone="neutral">Ready</Pill>}
    >
      <Card title="Communication Parameters">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">Line Settings</div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <Select
                  label="Port:"
                  value={port}
                  onChange={(value) => dispatch(setPort(value))}
                  options={["/dev/ttyUSB0", "/dev/ttymxc0", "COM3", "COM4"]}
                  className="w-full"
                />
                <div className="text-[11px] text-slate-500">
                  Linux: /dev/ttyUSB0, /dev/ttymxc0 • Windows: COM3, COM4
                </div>
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

      <Card title="Commands & Controls">
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-extrabold text-slate-300">Command Entry</div>
              <div className="flex flex-wrap items-center gap-2">
                <PrimaryButton onClick={() => dispatch(toggleConnState())}>
                  {connState === "Connected" ? "Disconnect" : "Connect"}
                </PrimaryButton>
                <PrimaryButton variant="soft" onClick={() => dispatch(clearLog())}>
                  Clear Log
                </PrimaryButton>
                <PrimaryButton variant="soft">Save Log</PrimaryButton>
              </div>
            </div>

            <div className="mt-3 flex gap-3">
              <input
                value={command}
                onChange={(e) => dispatch(setCommand(e.target.value))}
                placeholder="Enter command…"
                className="h-10 flex-1 rounded-lg bg-neutral-950/70 px-3 text-sm text-slate-100 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              />
              <PrimaryButton
                onClick={() => {
                  if (!command.trim()) return;
                  dispatch(appendLog(`[Send] ${command.trim()}`));
                  dispatch(setCommand(""));
                }}
              >
                Send
              </PrimaryButton>
            </div>

            <div className="mt-4">
              <div className="text-xs font-extrabold text-slate-300">Preset Commands</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {["AT+PING", "READ 01", "RESET", "STATUS?", "START"].map((label) => (
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

          <div className="rounded-lg bg-neutral-950/60 p-4 ring-1 ring-white/10">
            <div className="text-xs font-extrabold text-slate-300">Session Log</div>
            <textarea
              value={logText}
              readOnly
              className="mt-3 h-52 w-full resize-none rounded-lg bg-neutral-950 p-3 text-xs text-slate-300 ring-1 ring-white/10 focus:outline-none"
            />
          </div>
        </div>
      </Card>
    </PageShell>
  );
}

function DeviceManagement() {
  const dispatch = useAppDispatch();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const { connState, ready } = useAppSelector((state) => state.runtime);
  const { graphMode, running, sensorFilter, canFilter } = useAppSelector(
    (state) => state.management
  );
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;

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
      pageTitle="Device Management"
      subtitle={device ? `Monitoring ${device.name}` : "Manage and monitor multiple devices"}
      statusLeft={<Pill tone={connState === "Disconnected" ? "danger" : "success"}>{device?.name ?? "Device 1"}</Pill>}
      statusRight={
        <div className="flex items-center gap-3">
          <Pill tone={connState === "Disconnected" ? "danger" : "success"}>{connState}</Pill>
          <Pill tone={ready ? "neutral" : "neutral"}>Ready</Pill>
        </div>
      }
      right={
        <PrimaryButton
          variant="soft"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => dispatch(setDeviceView("config"))}
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
        title="Event Graph"
        right={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-white/5 p-1 ring-1 ring-white/10">
              {(["Live", "Historical"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => dispatch(setGraphMode(m))}
                  className={cn(
                    "rounded-md px-4 py-2 text-xs font-bold transition",
                    graphMode === m
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow"
                      : "text-slate-300 hover:text-slate-100"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            <PrimaryButton
              icon={running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              onClick={() => dispatch(toggleRunning())}
            >
              {running ? "Stop" : "Start"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="rounded-lg bg-neutral-950/40 p-4 ring-1 ring-white/10">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="text-xs font-extrabold text-slate-300">Filter by Sensors</div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-neutral-950/60 px-4 py-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-slate-200">
                  {sensorFilter}
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-300">Filter by CAN ID</div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-neutral-950/60 px-4 py-3 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-slate-200">{canFilter}</div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-neutral-950/50 p-5 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-neutral-500" />
                  <span>Sensor {i + 1}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-neutral-200" />
                <span>Events</span>
              </div>
            </div>

            <div className="mt-4 h-56 rounded-lg bg-neutral-950 ring-1 ring-white/10">
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">
                Chart placeholder
              </div>
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

  return (
    <PageShell
      pageTitle="Devices"
      subtitle="Add and configure your devices"
      statusLeft={<Pill tone="neutral">Fleet</Pill>}
      right={
        <div className="flex items-center gap-3">
          <PrimaryButton onClick={() => dispatch(addDevice())} variant="soft">
            Add Device
          </PrimaryButton>
        </div>
      }
    >
      <Card title="Registered Devices">
        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <div
              key={device.id}
              className="rounded-lg bg-neutral-950/60 p-5 ring-1 ring-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-100">{device.name}</div>
                  <div className="text-xs text-slate-400">{device.id}</div>
                </div>
                <Pill tone={device.status === "Connected" ? "success" : "danger"}>
                  {device.status}
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
                >
                  Monitor
                </PrimaryButton>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

function EventsPlaceholder() {
  return (
    <PageShell pageTitle="Events" subtitle="Placeholder">
      <Card>
        <div className="text-sm text-slate-400">Events page placeholder.</div>
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
        <EventsPlaceholder />
      )}
    </>
  );
}
