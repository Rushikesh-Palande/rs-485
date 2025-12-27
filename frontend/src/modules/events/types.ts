export type EventSeverity = "info" | "success" | "warning" | "error";

export type EventType =
  | "Connection"
  | "Command"
  | "Serial"
  | "Config"
  | "Device"
  | "System";

export type AppEvent = {
  id: string;
  ts: string; // ISO timestamp
  deviceId?: string | null;
  type: EventType;
  severity: EventSeverity;
  message: string;
  source: "serial" | "config" | "command" | "device" | "system";
};
