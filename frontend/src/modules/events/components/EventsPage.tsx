import React, { useMemo, useState } from "react";
import { useAppSelector } from "../../../app/hooks";
import type { EventSeverity } from "../types";
import { Card } from "../../../shared/components/Card";
import { Pill } from "../../../shared/components/Pill";
import { Select } from "../../../shared/components/Select";
import { StatTile } from "../../../shared/components/StatTile";
import { PageShell } from "../../ui/components/PageShell";

export function EventsPage() {
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

  const severityTone = (severity: EventSeverity) => {
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
                    <Pill tone={severityTone(evt.severity)}>
                      {evt.severity.toUpperCase()}
                    </Pill>
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
