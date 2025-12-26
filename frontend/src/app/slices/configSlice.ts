import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type ConfigState = {
  port: string;
  baud: string;
  parity: string;
  stopBits: string;
  dataBits: string;
  readTimeout: string;
  writeTimeout: string;
  frameFormat: string;
  modbusEnabled: boolean;
};

const initialState: ConfigState = {
  port: "/dev/ttyUSB0",
  baud: "9600",
  parity: "Even",
  stopBits: "2",
  dataBits: "8",
  readTimeout: "500",
  writeTimeout: "300",
  frameFormat: "Modbus RTU",
  modbusEnabled: true,
};

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setPort(state, action: PayloadAction<string>) {
      state.port = action.payload;
    },
    setBaud(state, action: PayloadAction<string>) {
      state.baud = action.payload;
    },
    setParity(state, action: PayloadAction<string>) {
      state.parity = action.payload;
    },
    setStopBits(state, action: PayloadAction<string>) {
      state.stopBits = action.payload;
    },
    setReadTimeout(state, action: PayloadAction<string>) {
      state.readTimeout = action.payload;
    },
    setWriteTimeout(state, action: PayloadAction<string>) {
      state.writeTimeout = action.payload;
    },
    setFrameFormat(state, action: PayloadAction<string>) {
      state.frameFormat = action.payload;
    },
    setModbusEnabled(state, action: PayloadAction<boolean>) {
      state.modbusEnabled = action.payload;
    },
  },
});

export const {
  setPort,
  setBaud,
  setParity,
  setStopBits,
  setReadTimeout,
  setWriteTimeout,
  setFrameFormat,
  setModbusEnabled,
} = configSlice.actions;
export default configSlice.reducer;
