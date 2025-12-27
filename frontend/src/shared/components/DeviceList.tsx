import React, { useMemo } from "react";
import type { DeviceSummary } from "../types/telemetry";

export function DeviceList(props: {
  devices: DeviceSummary[];
  selected?: string;
  onSelect: (uid: string) => void;
  filter: string;
  onFilter: (v: string) => void;
}) {
  const items = useMemo(() => {
    const f = props.filter.trim().toLowerCase();
    if (!f) return props.devices;
    return props.devices.filter((d) => d.device_uid.toLowerCase().includes(f));
  }, [props.devices, props.filter]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl h-full">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Devices</div>
          <div className="text-xs text-slate-400">{items.length} visible</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
          Realtime
        </span>
      </div>

      <div className="p-4 space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500/50"
          placeholder="Search device_uid…"
          value={props.filter}
          onChange={(e) => props.onFilter(e.target.value)}
        />

        <div className="max-h-[480px] overflow-auto rounded-xl border border-white/10">
          <div className="grid grid-cols-[1fr_120px] gap-2 px-3 py-2 text-xs text-slate-400 border-b border-white/10">
            <div>device_uid</div>
            <div>last seen</div>
          </div>

          {items.map((d, idx) => {
            const active = d.device_uid === props.selected;
            const ts = d.last_seen_ts ?? d.last_ts;
            const time = ts ? new Date(ts).toLocaleTimeString() : "-";

            return (
              <button
                key={d.device_uid}
                onClick={() => props.onSelect(d.device_uid)}
                className={[
                  "w-full grid grid-cols-[1fr_120px] gap-2 px-3 py-2 text-left text-xs",
                  "border-b border-white/5 hover:bg-white/[0.04]",
                  idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent",
                  active ? "bg-sky-500/10" : "",
                ].join(" ")}
              >
                <div className="font-mono text-slate-200 truncate">{d.device_uid}</div>
                <div className="text-slate-400">{time}</div>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400">
          Tip: Click a device to pin it. Graphs and parameters follow that device.
        </div>
      </div>
    </div>
  );
}
