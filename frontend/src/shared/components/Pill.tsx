import React from "react";
import type { PillTone } from "../types/common";
import { cn } from "../utils/cn";

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: React.ReactNode;
}) {
  const styles =
    tone === "danger"
      ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
      : tone === "success"
        ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
        : "bg-white/10 text-slate-200 ring-white/15";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1",
        styles
      )}
    >
      {children}
    </span>
  );
}
