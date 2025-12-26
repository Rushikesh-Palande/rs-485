import React from "react";
import { BrowserRouter, Route, Routes as RouterRoutes } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

function AppShell(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-slate-100">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl border border-white/10 bg-white/5 shadow-2xl" />
            <div>
              <div className="text-sm font-semibold tracking-tight">RS-485 Command Center</div>
              <div className="text-xs text-slate-400">
                WebGL realtime • downsampling • virtualization • record/replay
              </div>
            </div>
          </div>

          <div className="flex-1" />
        </div>
      </div>

      {/* Page content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">{props.children}</div>

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
