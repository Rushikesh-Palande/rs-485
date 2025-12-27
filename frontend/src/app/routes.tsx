import React from "react";
import { BrowserRouter, Route, Routes as RouterRoutes } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAppDispatch, useAppSelector } from "./hooks";
import { toggleSidebar } from "./slices/uiSlice";

function AppShell(props: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100">
      {/* Top bar */}
      <div
        className={`sticky top-0 z-20 w-full border-b border-white/10 bg-neutral-950/70 backdrop-blur transition-[margin,width] duration-200 ${
          sidebarOpen
            ? "sm:ml-[220px] sm:w-[calc(100%-220px)]"
            : "sm:ml-[72px] sm:w-[calc(100%-72px)]"
        }`}
      >
        <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-slate-200 shadow-2xl hover:bg-white/10"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              onClick={() => dispatch(toggleSidebar())}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight sm:text-base">
                Command Center
              </div>
              <div className="hidden text-xs text-slate-400 sm:block">

              </div>
            </div>
          </div>

          <div className="hidden flex-1 sm:block" />
        </div>
      </div>

      {/* Page content */}
      <div className="w-full px-6 py-6">{props.children}</div>

    </div>
  );
}

export function Routes() {
  return (
    <BrowserRouter>
      <AppShell>
        <RouterRoutes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Dashboard />} />
          <Route path="/config" element={<Dashboard />} />
          <Route path="/events" element={<Dashboard />} />
          <Route path="*" element={<Dashboard />} />
        </RouterRoutes>
      </AppShell>
    </BrowserRouter>
  );
}
