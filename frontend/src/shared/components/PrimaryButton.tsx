import React from "react";
import { cn } from "../utils/cn";

export function PrimaryButton({
  children,
  disabled,
  onClick,
  variant = "solid",
  icon,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  variant?: "solid" | "soft";
  icon?: React.ReactNode;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-400/50";

  const styles =
    variant === "soft"
      ? "bg-white/10 text-slate-100 hover:bg-white/15"
      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        base,
        styles,
        disabled && "cursor-not-allowed opacity-60 shadow-none hover:brightness-100",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
