import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnState } from "../types";

type RuntimeState = {
  connState: ConnState;
  ready: boolean;
  rawData: string;
  parsedData: string;
  errors: string;
  command: string;
  logText: string;
};

const initialState: RuntimeState = {
  connState: "Connected",
  ready: true,
  rawData: "3A 30 31 20 52 45 41 44 0D 0A\n7E 45 4E 51 3A 30 31 0D 0A\n7E 44 41 54 41 3A 31 32 33 2E 34 0D 0A",
  parsedData:
    "READ ok\nDevice: 01\nVoltage: 12.3 V\nCurrent: 1.04 A\nTemp: 36.8 C",
  errors: "Framing error (last 5 min: 2)",
  command: "READ 01",
  logText:
    "[12:41:12] Port open: /dev/ttyUSB0 @115200\n[12:41:17] RX: 3A 30 31 20 52 45 41 44 0D 0A\n[12:41:18] TX: READ 01\n[12:41:19] RX: 7E 44 41 54 41 3A 31 32 33 2E 34 0D 0A\n",
};

const runtimeSlice = createSlice({
  name: "runtime",
  initialState,
  reducers: {
    setConnState(state, action: PayloadAction<ConnState>) {
      state.connState = action.payload;
    },
    toggleConnState(state) {
      state.connState =
        state.connState === "Connected" ? "Disconnected" : "Connected";
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
    setLogText(state, action: PayloadAction<string>) {
      state.logText = action.payload;
    },
    appendLog(state, action: PayloadAction<string>) {
      state.logText = `${state.logText}${action.payload}\n`;
    },
    clearLog(state) {
      state.logText = "";
    },
  },
});

export const {
  setConnState,
  toggleConnState,
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
