export type TelemetryEvent = {
  ts: string; // ISO timestamp
  device_id?: string;
  device_uid?: string;
  metrics: Record<string, unknown>;
  quality?: Record<string, unknown> | null;
};

/**
 * Historical storage point (REST history endpoint).
 * Keeping this type exported fixes api.ts import.
 */
export type TelemetryHistoryPoint = {
  ts: string; // ISO timestamp
  metrics: Record<string, unknown>;
  quality?: Record<string, unknown> | null;
};

/**
 * Device summary for device list UI.
 *
 * NOTE: We include both `last_seen_ts` and `last_ts` for backward compatibility
 * because earlier iterations used `last_ts`, while UI expects `last_seen_ts`.
 */
export type DeviceSummary = {
  device_uid: string;

  // preferred (UI uses this)
  last_seen_ts?: string;

  // backward-compat
  last_ts?: string;

  last_metrics?: Record<string, unknown>;
};
