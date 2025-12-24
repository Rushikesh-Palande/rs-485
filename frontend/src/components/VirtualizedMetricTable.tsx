import React, { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";

/**
 * Virtualized parameter table:
 * - Handles 50k+ keys without DOM blowups.
 * - Sorting + filtering happens on the compact key list only.
 */
export function VirtualizedMetricTable(props: {
  metrics: Record<string, unknown> | undefined;
  filter: string;
  onFilter: (v: string) => void;
}) {
  const rows = useMemo(() => {
    const m = props.metrics ?? {};
    const f = props.filter.trim().toLowerCase();
    const entries = Object.entries(m);
    const filtered = f ? entries.filter(([k]) => k.toLowerCase().includes(f)) : entries;
    filtered.sort(([a], [b]) => a.localeCompare(b));
    return filtered;
  }, [props.metrics, props.filter]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Parameters</div>
          <div className="text-xs text-slate-400">{rows.length} keys</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
          Virtualized
        </span>
      </div>

      <div className="p-4 space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500/50"
          placeholder="Filter keys…"
          value={props.filter}
          onChange={(e) => props.onFilter(e.target.value)}
        />

        <div className="h-[380px] overflow-hidden rounded-xl border border-white/10">
          <Virtuoso
            data={rows}
            itemContent={(index, [k, v]) => (
              <div
                className={`grid grid-cols-[1fr_1fr] gap-3 px-3 py-2 text-xs ${
                  index % 2 === 0 ? "bg-white/[0.02]" : ""
                }`}
              >
                <div className="font-mono text-slate-200 truncate">{k}</div>
                <div className="font-mono text-slate-300 truncate">{String(v)}</div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
