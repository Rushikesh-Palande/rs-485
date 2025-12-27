import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { GraphMode } from "./types";

type ManagementState = {
  graphMode: GraphMode;
  running: boolean;
  sensorFilter: string;
  canFilter: string;
};

const initialState: ManagementState = {
  graphMode: "Live",
  running: false,
  sensorFilter: "All Sensors (12 selected)",
  canFilter: "All CAN IDs (3 selected)",
};

const managementSlice = createSlice({
  name: "management",
  initialState,
  reducers: {
    setGraphMode(state, action: PayloadAction<GraphMode>) {
      state.graphMode = action.payload;
    },
    setRunning(state, action: PayloadAction<boolean>) {
      state.running = action.payload;
    },
    toggleRunning(state) {
      state.running = !state.running;
    },
    setSensorFilter(state, action: PayloadAction<string>) {
      state.sensorFilter = action.payload;
    },
    setCanFilter(state, action: PayloadAction<string>) {
      state.canFilter = action.payload;
    },
  },
});

export const {
  setGraphMode,
  setRunning,
  toggleRunning,
  setSensorFilter,
  setCanFilter,
} = managementSlice.actions;
export default managementSlice.reducer;
