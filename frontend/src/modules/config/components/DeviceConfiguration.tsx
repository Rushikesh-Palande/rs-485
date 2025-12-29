import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw, ArrowLeft } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { addEvent } from "../../events/eventsSlice";
import { buildEvent } from "../../events/utils";
import { removeDevice, setDeviceConfigured, setSelectedDeviceId } from "../../devices/devicesSlice";
import { useNavigate } from "react-router-dom";
import {
  setBaud,
  setFrameFormat,
  setModbusEnabled,
  setParity,
  setPort,
  setReadTimeout,
  setStopBits,
  setWriteTimeout,
} from "../configSlice";
import { setConnectedDeviceId } from "../../monitor/runtimeSlice";
import { Card } from "../../../shared/components/Card";
import { Pill } from "../../../shared/components/Pill";
import { PrimaryButton } from "../../../shared/components/PrimaryButton";
import { Select } from "../../../shared/components/Select";
import { PageShell } from "../../ui/components/PageShell";
import { cn } from "../../../shared/utils/cn";
import type { ConnState } from "../../../shared/types/common";

export function DeviceConfiguration() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selectedDeviceId, devices } = useAppSelector((state) => state.devices);
  const device = devices.find((item) => item.id === selectedDeviceId) ?? null;
  const { connectedDeviceId } = useAppSelector((state) => state.runtime);
  const displayConnState: ConnState =
    device && device.configured && connectedDeviceId === device.id ? "Connected" : "Disconnected";
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
      dispatch(setConnectedDeviceId(device?.id ?? null));
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
      dispatch(setConnectedDeviceId(null));
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
      statusLeft={
        <Pill tone={displayConnState === "Disconnected" ? "danger" : "success"}>
          {displayConnState}
        </Pill>
      }
      statusRight={<Pill tone="neutral">Ready</Pill>}
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
                ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
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
                      className={cn(
                        "h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10",
                        isDetecting && "animate-pulse"
                      )}
                      disabled={isDetecting}
                      title={isDetecting ? "Detecting ports" : "Detect ports"}
                      aria-label="Detect ports"
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4 transition-transform duration-300",
                          isDetecting && "animate-spin"
                        )}
                      />
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
                  options={["ASCII", "Decimal", "Hex", "Modbus RTU"]}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <Pill tone="neutral">{port}</Pill>
          <Pill tone="neutral">{baud} bps</Pill>
          <Pill tone="neutral">Parity: {parity}</Pill>
          <Pill tone="neutral">Stop: {stopBits}</Pill>
          </div>
          <PrimaryButton
            variant="soft"
            className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
            onClick={() => {
              if (!device) return;
              dispatch(setSelectedDeviceId(device.id));
              navigate(`/devices/${device.id}/monitor`);
            }}
          >
            Monitor
          </PrimaryButton>
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
              navigate("/devices");
            }}
          >
            Remove Device
          </PrimaryButton>
        </div>
      </Card>
    </PageShell>
  );
}
