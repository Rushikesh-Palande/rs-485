import { get, set } from "idb-keyval";
import type { AppEvent } from "../../modules/events/types";

const EVENTS_KEY = "rs485.events.v1";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function pruneEvents(events: AppEvent[], now = Date.now()): AppEvent[] {
  return events.filter((evt) => now - new Date(evt.ts).getTime() <= MAX_AGE_MS);
}

export async function loadEventsFromDb(): Promise<AppEvent[]> {
  const stored = await get<AppEvent[] | undefined>(EVENTS_KEY);
  if (!stored || !Array.isArray(stored)) {
    return [];
  }
  const pruned = pruneEvents(stored);
  if (pruned.length !== stored.length) {
    await set(EVENTS_KEY, pruned);
  }
  return pruned;
}

export async function saveEventsToDb(events: AppEvent[]): Promise<void> {
  const pruned = pruneEvents(events);
  await set(EVENTS_KEY, pruned);
}
