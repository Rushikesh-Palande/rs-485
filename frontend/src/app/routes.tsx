import React from "react";
import { BrowserRouter, Route, Routes as RouterRoutes } from "react-router-dom";
import {
  DeviceConfigRoute,
  DeviceMonitorRoute,
  DevicesRoute,
  EventsRoute,
} from "../pages/RouteViews";
import { AppShell } from "../modules/ui/components/AppShell";

export function Routes() {
  return (
    <BrowserRouter>
      <AppShell>
        <RouterRoutes>
          <Route path="/" element={<DevicesRoute />} />
          <Route path="/devices" element={<DevicesRoute />} />
          <Route path="/devices/:deviceId/config" element={<DeviceConfigRoute />} />
          <Route path="/devices/:deviceId/monitor" element={<DeviceMonitorRoute />} />
          <Route path="/events" element={<EventsRoute />} />
          <Route path="*" element={<DevicesRoute />} />
        </RouterRoutes>
      </AppShell>
    </BrowserRouter>
  );
}
