import { CONFIG } from "./config";
import type { TelemetryHistoryPoint } from "./types";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${CONFIG.API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function fetchTelemetryHistory(params: {
  device_uid: string;
  limit?: number;
  start?: string;
  end?: string;
}): Promise<{ device_uid: string; points: TelemetryHistoryPoint[] }> {
  const q = new URLSearchParams();
  if (params.limit) q.set("limit", String(params.limit));
  if (params.start) q.set("start", params.start);
  if (params.end) q.set("end", params.end);
  return http(`/api/telemetry/${encodeURIComponent(params.device_uid)}/history?${q.toString()}`);
}

export async function fetchHealth(): Promise<any> {
  return http("/api/health");
}
