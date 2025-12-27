import { configureStore, type Middleware } from "@reduxjs/toolkit";
import uiReducer from "../modules/ui/uiSlice";
import devicesReducer from "../modules/devices/devicesSlice";
import configReducer from "../modules/config/configSlice";
import runtimeReducer from "../modules/monitor/runtimeSlice";
import managementReducer from "../modules/management/managementSlice";
import eventsReducer from "../modules/events/eventsSlice";
import { addEvent, clearEvents, setEvents } from "../modules/events/eventsSlice";
import { loadEventsFromDb, saveEventsToDb } from "../shared/lib/eventsDb";

const eventsPersistence: Middleware = (storeApi) => (next) => (action) => {
  const result = next(action);
  if (addEvent.match(action) || clearEvents.match(action) || setEvents.match(action)) {
    const state = storeApi.getState() as RootState;
    void saveEventsToDb(state.events.items);
  }
  return result;
};

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    devices: devicesReducer,
    config: configReducer,
    runtime: runtimeReducer,
    management: managementReducer,
    events: eventsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(eventsPersistence),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

void (async () => {
  const events = await loadEventsFromDb();
  if (events.length > 0) {
    store.dispatch(setEvents(events));
  }
})();
