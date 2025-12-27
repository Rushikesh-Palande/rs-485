import React from "react";
import type { Stat } from "../types/common";
import { cn } from "../utils/cn";

export function StatTile({ stat }: { stat: Stat }) {
  const variant = stat.variant ?? "soft";
  const cls =
    variant === "success"
      ? "bg-emerald-500 text-white"
      : variant === "gradient"
        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
        : "bg-neutral-950 text-slate-100";

  return (
    <div className={cn("rounded-lg p-4 ring-1 ring-white/10 shadow-sm", cls)}>
      <div
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          variant === "soft" ? "text-slate-400" : "text-white/85"
        )}
      >
        {stat.label}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div
          className={cn(
            "text-3xl font-extrabold",
            variant === "soft" ? "text-slate-100" : "text-white"
          )}
        >
          {stat.value}
        </div>
        {stat.unit ? (
          <div
            className={cn(
              "pb-1 text-xs font-semibold",
              variant === "soft" ? "text-slate-400" : "text-white/85"
            )}
          >
            {stat.unit}
          </div>
        ) : null}
      </div>
    </div>
  );
}
