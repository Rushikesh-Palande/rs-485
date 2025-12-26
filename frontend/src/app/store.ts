import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./slices/uiSlice";
import devicesReducer from "./slices/devicesSlice";
import configReducer from "./slices/configSlice";
import runtimeReducer from "./slices/runtimeSlice";
import managementReducer from "./slices/managementSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    devices: devicesReducer,
    config: configReducer,
    runtime: runtimeReducer,
    management: managementReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
