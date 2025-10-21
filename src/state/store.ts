import { configureStore } from "@reduxjs/toolkit";
import marketReducer from "./marketSlice";
import userReducer from "./userSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
  reducer: {
    market: marketReducer,
    user: userReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;



