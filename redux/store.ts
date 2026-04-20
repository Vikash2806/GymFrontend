import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/auth/authSlice";
import themeReducer from "./features/theme/themeSlice";
import rbacReducer from "./features/rbacSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    rbac: rbacReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
