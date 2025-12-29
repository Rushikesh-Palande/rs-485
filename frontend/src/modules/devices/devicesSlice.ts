import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnectionType, Device } from "./types";

type DevicesState = {
  devices: Device[];
  selectedDeviceId: string | null;
};

const initialDevices: Device[] = [
  {
    id: "DEV-001",
    name: "Device 1",
    status: "Disconnected",
    connection: "RS-485",
    lastSeen: "2 min ago",
    configured: false,
  },
  {
    id: "DEV-002",
    name: "Device 2",
    status: "Connected",
    connection: "TTL",
    lastSeen: "Just now",
    configured: false,
  },
];

const initialState: DevicesState = {
  devices: initialDevices,
  selectedDeviceId: initialDevices[0]?.id ?? null,
};

const devicesSlice = createSlice({
  name: "devices",
  initialState,
  reducers: {
    setDevices(state, action: PayloadAction<Device[]>) {
      state.devices = action.payload;
      if (!state.selectedDeviceId && state.devices.length > 0) {
        state.selectedDeviceId = state.devices[0].id;
      }
    },
    addDevice(state, action: PayloadAction<{ connection?: ConnectionType } | undefined>) {
      const nextIndex = state.devices.length + 1;
      const id = `DEV-${String(nextIndex).padStart(3, "0")}`;
      const connection = action.payload?.connection ?? "RS-485";
      state.devices.push({
        id,
        name: `Device ${nextIndex}`,
        status: "Disconnected",
        connection,
        lastSeen: "Just now",
        configured: false,
      });
      state.selectedDeviceId = id;
    },
    setDeviceConfigured(state, action: PayloadAction<{ id: string; configured: boolean }>) {
      const target = state.devices.find((device) => device.id === action.payload.id);
      if (target) {
        target.configured = action.payload.configured;
      }
    },
    removeDevice(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.devices = state.devices.filter((device) => device.id !== id);
      if (state.selectedDeviceId === id) {
        state.selectedDeviceId = state.devices[0]?.id ?? null;
      }
    },
    setSelectedDeviceId(state, action: PayloadAction<string | null>) {
      state.selectedDeviceId = action.payload;
    },
  },
});

export const { setDevices, addDevice, setDeviceConfigured, removeDevice, setSelectedDeviceId } =
  devicesSlice.actions;
export default devicesSlice.reducer;
