import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function SessionLogWindow() {
  const [params] = useSearchParams();
  const deviceId = params.get("deviceId") ?? "unassigned";
  const storageKey = useMemo(() => `session-log:${deviceId}`, [deviceId]);
  const [logText, setLogText] = useState("");

  useEffect(() => {
    try {
      setLogText(localStorage.getItem(storageKey) ?? "");
    } catch {
      setLogText("");
    }
  }, [storageKey]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setLogText(event.newValue ?? "");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-slate-100">
      <div className="text-sm font-semibold text-slate-100">Session Log</div>
      <div className="mt-1 text-xs text-slate-400">Device {deviceId}</div>
      <textarea
        value={logText}
        readOnly
        placeholder="No session data."
        className="mt-4 h-[80vh] w-full resize-none rounded-lg bg-neutral-900 p-4 text-xs text-slate-300 focus:outline-none font-mono"
      />
    </div>
  );
}
