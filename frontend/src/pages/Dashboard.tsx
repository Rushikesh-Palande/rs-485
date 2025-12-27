import React from "react";
import { useAppSelector } from "../app/hooks";
import { DevicesPage } from "../modules/devices/components/DevicesPage";
import { DeviceConfiguration } from "../modules/config/components/DeviceConfiguration";
import { DeviceMonitor } from "../modules/monitor/components/DeviceMonitor";
import { EventsPage } from "../modules/events/components/EventsPage";

export default function Dashboard() {
  const nav = useAppSelector((state) => state.ui.nav);
  const deviceView = useAppSelector((state) => state.ui.deviceView);

  if (nav === "config") {
    return deviceView === "config" ? <DeviceConfiguration /> : <DeviceMonitor />;
  }

  if (nav === "events") {
    return <EventsPage />;
  }

  return <DevicesPage />;
}
