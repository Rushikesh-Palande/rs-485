import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { DeviceConfiguration } from "../modules/config/components/DeviceConfiguration";
import { DevicesPage } from "../modules/devices/components/DevicesPage";
import { DeviceMonitor } from "../modules/monitor/components/DeviceMonitor";
import { EventsPage } from "../modules/events/components/EventsPage";
import { setSelectedDeviceId } from "../modules/devices/devicesSlice";
import { setDeviceView, setNav } from "../modules/ui/uiSlice";

function useSelectDevice(deviceId?: string) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const devices = useAppSelector((state) => state.devices.devices);

  useEffect(() => {
    if (!deviceId) return;
    const exists = devices.some((device) => device.id === deviceId);
    if (!exists) {
      navigate("/devices");
      return;
    }
    dispatch(setSelectedDeviceId(deviceId));
  }, [deviceId, devices, dispatch, navigate]);
}

export function DevicesRoute() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setNav("dash"));
  }, [dispatch]);
  return <DevicesPage />;
}

export function EventsRoute() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setNav("events"));
  }, [dispatch]);
  return <EventsPage />;
}

export function DeviceConfigRoute() {
  const dispatch = useAppDispatch();
  const { deviceId } = useParams<{ deviceId: string }>();
  useSelectDevice(deviceId);
  useEffect(() => {
    dispatch(setNav("config"));
    dispatch(setDeviceView("config"));
  }, [dispatch]);
  return <DeviceConfiguration />;
}

export function DeviceMonitorRoute() {
  const dispatch = useAppDispatch();
  const { deviceId } = useParams<{ deviceId: string }>();
  useSelectDevice(deviceId);
  useEffect(() => {
    dispatch(setNav("config"));
    dispatch(setDeviceView("management"));
  }, [dispatch]);
  return <DeviceMonitor />;
}
