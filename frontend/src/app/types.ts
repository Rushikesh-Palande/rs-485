export type NavKey = "dash" | "config" | "events";

export type ConnState = "Disconnected" | "Connected";

export type PillTone = "neutral" | "danger" | "success";

export type ConnectionType = "RS-485" | "TTL";

export type Mode = "Normal (Dual Channel)" | "Normal (Single Channel)" | "Listen Only";

export type FPS = 10 | 50 | 100 | 250 | 500 | 1000;

export type Stat = {
  label: string;
  value: string | number;
  unit?: string;
  variant?: "soft" | "gradient" | "success";
};

export type Device = {
  id: string;
  name: string;
  status: ConnState;
  connection: ConnectionType;
  lastSeen: string;
  configured?: boolean;
};

export type GraphMode = "Live" | "Historical";

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
