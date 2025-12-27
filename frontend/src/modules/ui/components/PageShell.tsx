import React from "react";
import { useAppSelector } from "../../../app/hooks";
import { cn } from "../../../shared/utils/cn";
import { Sidebar } from "./Sidebar";

export function PageShell({
  pageTitle,
  subtitle,
  statusLeft,
  statusRight,
  right,
  children,
}: {
  pageTitle: string;
  subtitle?: string;
  statusLeft?: React.ReactNode;
  statusRight?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 text-slate-100">
      <Sidebar />
      <main
        className={cn(
          "min-h-screen px-10 py-10 transition-[padding] duration-200",
          sidebarOpen ? "pl-[220px]" : "pl-[72px]"
        )}
      >
        <div className="w-full">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
                {pageTitle}
              </h1>
              {subtitle ? (
                <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
              ) : null}
              <div className="mt-4 flex items-center gap-3">
                {statusLeft}
                {statusRight}
              </div>
            </div>
            {right}
          </div>

          <div className="mt-8 space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
