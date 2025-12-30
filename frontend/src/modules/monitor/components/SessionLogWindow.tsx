import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PrimaryButton } from "../../../shared/components/PrimaryButton";

function ensureTrailingNewline(value: string): string {
  if (!value) return value;
  return value.endsWith("\n") ? value : `${value}\n`;
}

export function SessionLogWindow() {
  const [params] = useSearchParams();
  const deviceId = params.get("deviceId") ?? "unassigned";
  const storageKey = useMemo(() => `session-log:${deviceId}`, [deviceId]);
  const [logText, setLogText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLogText(ensureTrailingNewline(localStorage.getItem(storageKey) ?? ""));
    } catch {
      setLogText("");
    }
  }, [storageKey]);

  useEffect(() => {
    const key = `session-log-open:${deviceId}`;
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // Ignore storage errors.
    }
    const onUnload = () => {
      try {
        localStorage.setItem(`session-log-closed:${deviceId}`, String(Date.now()));
      } catch {
        // Ignore storage errors.
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [deviceId]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void (async () => {
      try {
        const { isTauri } = await import("@tauri-apps/api/core");
        if (!isTauri()) return;
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const win = getCurrentWebviewWindow();
        unlisten = await win.onCloseRequested(() => {
          try {
            localStorage.setItem(`session-log-closed:${deviceId}`, String(Date.now()));
          } catch {
            // Ignore storage errors.
          }
        });
      } catch {
        // Ignore event binding failures.
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, [deviceId]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setLogText(ensureTrailingNewline(event.newValue ?? ""));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      try {
        const next = ensureTrailingNewline(localStorage.getItem(storageKey) ?? "");
        setLogText((current) => (current === next ? current : next));
      } catch {
        // Ignore storage errors.
      }
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [storageKey]);

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Session Log</div>
          <div className="mt-1 text-xs text-slate-400">Device {deviceId}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton
            variant="soft"
            onClick={() => {
              try {
                localStorage.setItem(storageKey, "");
                localStorage.setItem(`session-log-clear:${deviceId}`, String(Date.now()));
                setLogText("");
                setStatus("Log cleared.");
              } catch {
                setStatus("Failed to clear log.");
              }
            }}
          >
            Clear Log
          </PrimaryButton>
          <PrimaryButton
            variant="soft"
            onClick={async () => {
              if (!logText.trim()) {
                setStatus("No log data to save.");
                return;
              }
              try {
                const { isTauri, invoke } = await import("@tauri-apps/api/core");
                if (!isTauri()) {
                  setStatus("Save requires the desktop app.");
                  return;
                }
                const path = await invoke<string>("save_session_log", {
                  contents: ensureTrailingNewline(logText),
                });
                setStatus(`Saved to ${path}`);
              } catch (error) {
                setStatus(`Save failed: ${String(error)}`);
              }
            }}
          >
            Save Log
          </PrimaryButton>
        </div>
      </div>
      {status ? (
        <div className="mt-3 text-xs font-semibold text-slate-300">{status}</div>
      ) : null}
      <textarea
        value={logText}
        readOnly
        placeholder="No session data."
        className="mt-4 h-[80vh] w-full resize-none rounded-lg bg-neutral-900 p-4 text-xs text-slate-300 focus:outline-none font-mono"
      />
    </div>
  );
}
