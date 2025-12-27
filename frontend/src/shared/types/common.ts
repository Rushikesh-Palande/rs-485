export type ConnState = "Disconnected" | "Connected";

export type PillTone = "neutral" | "danger" | "success";

export type Stat = {
  label: string;
  value: string | number;
  unit?: string;
  variant?: "soft" | "gradient" | "success";
};
