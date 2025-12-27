import type { ConnState } from "../../shared/types/common";

export type ConnectionType = "RS-485" | "TTL";

export type Device = {
  id: string;
  name: string;
  status: ConnState;
  connection: ConnectionType;
  lastSeen: string;
  configured?: boolean;
};
