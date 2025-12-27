import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { NavKey } from "./types";

type UiState = {
  nav: NavKey;
  deviceView: "config" | "management";
  sidebarOpen: boolean;
};

const initialState: UiState = {
  nav: "dash",
  deviceView: "config",
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setNav(state, action: PayloadAction<NavKey>) {
      state.nav = action.payload;
    },
    setDeviceView(state, action: PayloadAction<"config" | "management">) {
      state.deviceView = action.payload;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { setNav, setDeviceView, setSidebarOpen, toggleSidebar } =
  uiSlice.actions;
export default uiSlice.reducer;
