import type { AppEvent } from "./types";

export function buildEvent(payload: Omit<AppEvent, "id" | "ts">): AppEvent {
  return {
    ...payload,
    id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: new Date().toISOString(),
  };
}
