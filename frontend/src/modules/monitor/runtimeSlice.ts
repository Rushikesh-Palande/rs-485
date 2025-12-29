import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnState } from "../../shared/types/common";

type RuntimeState = {
  connState: ConnState;
  connectedDeviceId: string | null;
  ready: boolean;
  rawData: string;
  parsedData: string;
  errors: string;
  command: string;
  logByDevice: Record<string, string>;
  telemetryStats: {
    ch1Tx: number;
    ch1Rx: number;
    ch2Tx: number;
    ch2Rx: number;
    totalTx: number;
    totalRx: number;
    ok: number;
    err: number;
    txFps: number;
    rxFps: number;
  };
};

const initialState: RuntimeState = {
  connState: "Disconnected",
  connectedDeviceId: null,
  ready: true,
  rawData: "3A 30 31 20 52 45 41 44 0D 0A\n7E 45 4E 51 3A 30 31 0D 0A\n7E 44 41 54 41 3A 31 32 33 2E 34 0D 0A",
  parsedData:
    "READ ok\nDevice: 01\nVoltage: 12.3 V\nCurrent: 1.04 A\nTemp: 36.8 C",
  errors: "Framing error (last 5 min: 2)",
  command: "READ 01",
  logByDevice: {},
  telemetryStats: {
    ch1Tx: 0,
    ch1Rx: 0,
    ch2Tx: 0,
    ch2Rx: 0,
    totalTx: 0,
    totalRx: 0,
    ok: 0,
    err: 0,
    txFps: 0,
    rxFps: 0,
  },
};

const runtimeSlice = createSlice({
  name: "runtime",
  initialState,
  reducers: {
    setConnState(state, action: PayloadAction<ConnState>) {
      state.connState = action.payload;
      if (action.payload === "Disconnected") {
        state.connectedDeviceId = null;
      }
    },
    setConnectedDeviceId(state, action: PayloadAction<string | null>) {
      state.connectedDeviceId = action.payload;
      state.connState = action.payload ? "Connected" : "Disconnected";
    },
    setTelemetryStats(
      state,
      action: PayloadAction<Partial<RuntimeState["telemetryStats"]>>
    ) {
      state.telemetryStats = { ...state.telemetryStats, ...action.payload };
    },
    setReady(state, action: PayloadAction<boolean>) {
      state.ready = action.payload;
    },
    setRawData(state, action: PayloadAction<string>) {
      state.rawData = action.payload;
    },
    setParsedData(state, action: PayloadAction<string>) {
      state.parsedData = action.payload;
    },
    setErrors(state, action: PayloadAction<string>) {
      state.errors = action.payload;
    },
    setCommand(state, action: PayloadAction<string>) {
      state.command = action.payload;
    },
    setLogText(state, action: PayloadAction<{ deviceId: string; text: string }>) {
      state.logByDevice[action.payload.deviceId] = action.payload.text;
    },
    appendLog(state, action: PayloadAction<{ deviceId: string; entry: string }>) {
      const current = state.logByDevice[action.payload.deviceId] ?? "";
      state.logByDevice[action.payload.deviceId] = `${current}${action.payload.entry}\n`;
    },
    clearLog(state, action: PayloadAction<string>) {
      state.logByDevice[action.payload] = "";
    },
  },
});

export const {
  setConnState,
  setConnectedDeviceId,
  setTelemetryStats,
  setReady,
  setRawData,
  setParsedData,
  setErrors,
  setCommand,
  setLogText,
  appendLog,
  clearLog,
} = runtimeSlice.actions;
export default runtimeSlice.reducer;
