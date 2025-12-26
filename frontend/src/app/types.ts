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
};

export type GraphMode = "Live" | "Historical";
