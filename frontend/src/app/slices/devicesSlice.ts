import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Device } from "../types";

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
  },
  {
    id: "DEV-002",
    name: "Device 2",
    status: "Connected",
    connection: "TTL",
    lastSeen: "Just now",
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
    addDevice(state) {
      const nextIndex = state.devices.length + 1;
      const id = `DEV-${String(nextIndex).padStart(3, "0")}`;
      state.devices.push({
        id,
        name: `Device ${nextIndex}`,
        status: "Disconnected",
        connection: "RS-485",
        lastSeen: "Just now",
      });
      state.selectedDeviceId = id;
    },
    setSelectedDeviceId(state, action: PayloadAction<string | null>) {
      state.selectedDeviceId = action.payload;
    },
  },
});

export const { setDevices, addDevice, setSelectedDeviceId } =
  devicesSlice.actions;
export default devicesSlice.reducer;
