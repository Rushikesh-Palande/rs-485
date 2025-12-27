import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";

export function Select({
  value,
  onChange,
  options,
  label,
  className,
  disabled,
  stacked,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label?: string;
  className?: string;
  disabled?: boolean;
  stacked?: boolean;
}) {
  return (
    <label
      className={cn(
        stacked ? "flex flex-col items-start gap-2" : "flex items-center gap-2",
        className
      )}
    >
      {label ? (
        <span
          className={cn(
            "text-xs font-semibold text-slate-300",
            stacked ? "min-w-0" : "min-w-[120px]"
          )}
        >
          {label}
        </span>
      ) : null}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "h-9 appearance-none rounded-lg bg-neutral-950/70 px-3 pr-9 text-sm font-medium text-slate-100 ring-1 ring-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400/40",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}
