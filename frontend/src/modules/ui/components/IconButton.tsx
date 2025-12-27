import React from "react";
import { cn } from "../../../shared/utils/cn";

export function IconButton({
  active,
  icon,
  label,
  onClick,
  showLabel,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  showLabel?: boolean;
}) {
  const base = "group relative flex items-center transition";
  const layout = showLabel
    ? "h-10 w-full justify-start gap-3 rounded-lg px-3"
    : "h-12 w-12 justify-center rounded-xl";
  return (
    <button
      onClick={onClick}
      className={cn(
        base,
        layout,
        active
          ? "bg-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          : "hover:bg-white/10"
      )}
      aria-label={label}
      title={label}
      type="button"
    >
      <span className={cn(active ? "text-white" : "text-white/80 group-hover:text-white")}>
        {icon}
      </span>
      {showLabel ? (
        <span className={cn("text-xs font-semibold tracking-wide", active ? "text-white" : "text-white/80")}>
          {label}
        </span>
      ) : null}
    </button>
  );
}
