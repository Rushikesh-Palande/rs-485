import React from "react";
import { BrowserRouter, Route, Routes as RouterRoutes } from "react-router-dom";
import Dashboard from "../pages/Dashboard";
import { AppShell } from "../modules/ui/components/AppShell";

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
