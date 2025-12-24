import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TelemetryEvent } from "../lib/types";
import { RealtimeClient } from "../lib/ws";
import { lttb, type XY } from "../lib/downsample_lttb";
import { WebGLChart } from "../components/WebGLChart";
import { VirtualizedMetricTable } from "../components/VirtualizedMetricTable";
import { appendEvents, clearRecording, exportRecordingJsonl, loadRecording, startRecording, stopRecording } from "../lib/recorder";

function deviceUid(ev: TelemetryEvent): string {
  return String(ev.device_uid ?? ev.device_id ?? "unknown");
}

function numericKeys(metrics: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(metrics)) {
    if (typeof v === "number" && Number.isFinite(v)) out.push(k);
  }
  out.sort();
  return out;
}

/**
 * FINAL BOSS Dashboard:
 * - WebGL charts (ECharts GL) for high FPS
 * - Client-side downsampling (LTTB) for stable render budget
 * - Virtualized parameter table (50k+ keys)
 * - Multi-metric overlay
 * - Record & Replay (IndexedDB) + Export JSONL
 */
export default function Dashboard() {
  const [connected, setConnected] = useState(false);

  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState("");

  const [metricFilter, setMetricFilter] = useState("");

  const [overlayKeys, setOverlayKeys] = useState<string[]>([]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);

  const [recording, setRecording] = useState<"idle" | "recording" | "replaying">("idle");

  // last event per device
  const latestByDevice = useRef(new Map<string, TelemetryEvent>());

  // per-key timeseries store (selected device)
  const seriesStore = useRef(new Map<string, XY[]>());

  // throughput
  const msgCounter = useRef(0);
  const [msgsPerSec, setMsgsPerSec] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgsPerSec(msgCounter.current);
      msgCounter.current = 0;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Realtime WS ingestion
  useEffect(() => {
    const client = new RealtimeClient(
      "/ws/realtime",
      async (batch) => {
        msgCounter.current += batch.length;

        if (recording === "recording") {
          await appendEvents(batch);
        }

        for (const ev of batch) {
          const uid = deviceUid(ev);
          latestByDevice.current.set(uid, ev);
        }

        // Update device list (derived from latestByDevice keys)
        const all = Array.from(latestByDevice.current.keys()).sort();
        setDevices(all);
        if (!selectedDevice && all.length) setSelectedDevice(all[0]);

        // Update selected device series data
        if (selectedDevice) {
          const ev = latestByDevice.current.get(selectedDevice);
          if (!ev?.metrics) return;

          const keys = numericKeys(ev.metrics);
          setAvailableKeys(keys);

          // default overlays: first 2 numeric keys
          if (overlayKeys.length === 0 && keys.length) {
            setOverlayKeys(keys.slice(0, Math.min(2, keys.length)));
          }

          const t = Date.parse(ev.ts);

          for (const k of overlayKeys) {
            const v = (ev.metrics as any)[k];
            if (typeof v !== "number") continue;

            const arr = seriesStore.current.get(k) ?? [];
            arr.push({ x: t, y: v });

            // Keep last N raw points (prevents unbounded RAM growth)
            const MAX = 30_000;
            if (arr.length > MAX) arr.splice(0, arr.length - MAX);

            seriesStore.current.set(k, arr);
          }
        }
      },
      (s) => setConnected(s.connected)
    );

    client.start();
    return () => client.stop();
  }, [selectedDevice, overlayKeys, recording]);

  const filteredDevices = useMemo(() => {
    const f = deviceFilter.trim().toLowerCase();
    if (!f) return devices;
    return devices.filter((d) => d.toLowerCase().includes(f));
  }, [devices, deviceFilter]);

  const selectedEvent = useMemo(() => {
    if (!selectedDevice) return null;
    return latestByDevice.current.get(selectedDevice) ?? null;
  }, [selectedDevice, devices]);

  // Downsampled chart series
  const chartSeries = useMemo(() => {
    const out: { name: string; points: XY[] }[] = [];
    const budget = 2000;

    for (const k of overlayKeys) {
      const raw = seriesStore.current.get(k) ?? [];
      const points = raw.length > budget ? lttb(raw, budget) : raw;
      out.push({ name: k, points });
    }
    return out;
  }, [overlayKeys, selectedDevice, devices]);

  async function onStartRecording() {
    await startRecording();
    setRecording("recording");
  }

  async function onStopRecording() {
    await stopRecording();
    setRecording("idle");
  }

  async function onReplay() {
    const rec = await loadRecording();
    if (!rec || rec.events.length === 0) return;

    setRecording("replaying");

    // reset
    latestByDevice.current.clear();
    seriesStore.current.clear();
    setOverlayKeys([]);
    setSelectedDevice(null);

    // replay fast but stable (simulate realtime without freezing UI)
    const SPEED = 2000; // events per tick
    let i = 0;

    const tick = () => {
      const chunk = rec.events.slice(i, i + SPEED);
      i += SPEED;

      for (const ev of chunk) {
        latestByDevice.current.set(deviceUid(ev), ev);
      }

      const all = Array.from(latestByDevice.current.keys()).sort();
      setDevices(all);
      if (!selectedDevice && all.length) setSelectedDevice(all[0]);

      if (i < rec.events.length) {
        setTimeout(tick, 16);
      } else {
        setRecording("idle");
      }
    };

    tick();
  }

  async function onClear() {
    await clearRecording();
  }

  async function onExport() {
    await exportRecordingJsonl("rs485-recording");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1400px] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div>
            <div className="text-xl font-semibold tracking-tight">RS-485 Command Center</div>
            <div className="text-xs text-slate-400">
              WebGL realtime charts • downsampling • virtualized params • record & replay
            </div>
          </div>

          <div className="flex-1" />

          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              connected
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-400/10 text-rose-200"
            }`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {msgsPerSec} msg/s
          </span>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Devices */}
          <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Devices</div>
                <div className="text-xs text-slate-400">{filteredDevices.length} visible</div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                Realtime
              </span>
            </div>

            <div className="p-4 space-y-3">
              <input
                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500/50"
                placeholder="Search device_uid…"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
              />

              <div className="max-h-[420px] overflow-auto rounded-xl border border-white/10">
                {filteredDevices.map((d) => (
                  <button
                    key={d}
                    className={`w-full px-3 py-2 text-left text-xs font-mono border-b border-white/5 hover:bg-white/[0.04] ${
                      d === selectedDevice ? "bg-sky-500/10" : ""
                    }`}
                    onClick={() => {
                      setSelectedDevice(d);
                      seriesStore.current.clear();
                      setOverlayKeys([]);
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart + overlay */}
          <div className="lg:col-span-2 space-y-4">
            <WebGLChart title={`Live (device: ${selectedDevice ?? "-"})`} series={chartSeries} height={360} />

            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">Overlay metrics</div>
                  <div className="text-xs text-slate-400">Select multiple numeric keys</div>
                </div>

                <div className="flex gap-2">
                  {recording !== "recording" ? (
                    <button
                      onClick={onStartRecording}
                      className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-400/15"
                    >
                      Record
                    </button>
                  ) : (
                    <button
                      onClick={onStopRecording}
                      className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs text-rose-200 hover:bg-rose-400/15"
                    >
                      Stop
                    </button>
                  )}

                  <button
                    onClick={onReplay}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Replay
                  </button>

                  <button
                    onClick={onExport}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Export .jsonl
                  </button>

                  <button
                    onClick={onClear}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {availableKeys.slice(0, 120).map((k) => {
                    const active = overlayKeys.includes(k);
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setOverlayKeys((prev) =>
                            active ? prev.filter((x) => x !== k) : [...prev, k].slice(0, 6)
                          );
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-mono border ${
                          active
                            ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                            : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                        }`}
                        title="Toggle overlay"
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 text-xs text-slate-400">
                  Showing first 120 numeric keys (fast). You can add a search box later if needed.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Virtualized params */}
        <VirtualizedMetricTable metrics={selectedEvent?.metrics} filter={metricFilter} onFilter={setMetricFilter} />
      </div>
    </div>
  );
}
