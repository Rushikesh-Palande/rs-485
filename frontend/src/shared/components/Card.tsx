import React from "react";
import { cn } from "../utils/cn";

export function Card({
  title,
  right,
  className,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-neutral-900/80 p-6 shadow-[0_14px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10",
        className
      )}
    >
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between">
          {title ? (
            <div className="text-sm font-semibold text-slate-100">{title}</div>
          ) : (
            <div />
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
