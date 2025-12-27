import { get, set, del } from "idb-keyval";
import type { TelemetryEvent } from "../types/telemetry";
import { isTauri } from "./tauri";

const KEY = "rs485:recording:v1";

export type Recording = {
  startedAt: number;
  stoppedAt?: number;
  events: TelemetryEvent[];
};

export async function loadRecording(): Promise<Recording | null> {
  return (await get(KEY)) ?? null;
}

export async function clearRecording(): Promise<void> {
  await del(KEY);
}

export async function startRecording(): Promise<Recording> {
  const rec: Recording = { startedAt: Date.now(), events: [] };
  await set(KEY, rec);
  return rec;
}

export async function appendEvents(events: TelemetryEvent[]): Promise<void> {
  const rec = (await get(KEY)) as Recording | undefined;
  if (!rec) return;
  rec.events.push(...events);
  await set(KEY, rec);
}

export async function stopRecording(): Promise<Recording | null> {
  const rec = (await get(KEY)) as Recording | undefined;
  if (!rec) return null;
  rec.stoppedAt = Date.now();
  await set(KEY, rec);
  return rec;
}

/**
 * Export recording as JSONL (one JSON per line).
 * Perfect for debugging: you can grep, stream, and replay easily.
 *
 * - Web: triggers browser download.
 * - Tauri: opens save dialog + writes using plugin-fs.
 */
export async function exportRecordingJsonl(filenameBase = "rs485-recording"): Promise<void> {
  const rec = await loadRecording();
  if (!rec || rec.events.length === 0) return;

  const jsonl = rec.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const suggested = `${filenameBase}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

  if (!isTauri()) {
    const blob = new Blob([jsonl], { type: "application/jsonl" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggested;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Tauri path
  const dialog = await import("@tauri-apps/plugin-dialog");
  const fs = await import("@tauri-apps/plugin-fs");

  const path = await dialog.save({
    defaultPath: suggested,
    title: "Export Recording (JSONL)",
    filters: [{ name: "JSON Lines", extensions: ["jsonl"] }],
  });

  if (!path) return;
  await fs.writeTextFile(path, jsonl);
}
