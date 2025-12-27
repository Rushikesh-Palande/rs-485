import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppEvent } from "../types";

type EventsState = {
  items: AppEvent[];
};

const initialState: EventsState = {
  items: [],
};

const eventsSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    addEvent(state, action: PayloadAction<AppEvent>) {
      state.items.unshift(action.payload);
      if (state.items.length > 500) {
        state.items.pop();
      }
    },
    setEvents(state, action: PayloadAction<AppEvent[]>) {
      state.items = action.payload;
    },
    clearEvents(state) {
      state.items = [];
    },
  },
});

export const { addEvent, setEvents, clearEvents } = eventsSlice.actions;
export default eventsSlice.reducer;
