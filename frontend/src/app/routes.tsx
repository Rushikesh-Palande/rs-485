import React from "react";
import { BrowserRouter, Route, Routes as RouterRoutes } from "react-router-dom";
import {
  DeviceConfigRoute,
  DeviceMonitorRoute,
  DevicesRoute,
  EventsRoute,
  SessionLogRoute,
} from "../pages/RouteViews";
import { AppShell } from "../modules/ui/components/AppShell";
import { Outlet } from "react-router-dom";

export function Routes() {
  return (
    <BrowserRouter>
      <RouterRoutes>
        <Route path="/session-log" element={<SessionLogRoute />} />
        <Route element={<AppShell><Outlet /></AppShell>}>
          <Route path="/" element={<DevicesRoute />} />
          <Route path="/devices" element={<DevicesRoute />} />
          <Route path="/devices/:deviceId/config" element={<DeviceConfigRoute />} />
          <Route path="/devices/:deviceId/monitor" element={<DeviceMonitorRoute />} />
          <Route path="/events" element={<EventsRoute />} />
          <Route path="*" element={<DevicesRoute />} />
        </Route>
      </RouterRoutes>
    </BrowserRouter>
  );
}
