"use client";

import { useEffect } from "react";
import { Provider, useStore } from "react-redux";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/utils/authSession";
import { logout } from "./features/auth/authSlice";
import { store } from "./store";

type ReduxProviderProps = Readonly<{ children: React.ReactNode }>;

function SessionExpiredListener() {
  const reduxStore = useStore<typeof store>();

  useEffect(() => {
    const onSessionExpired = () => {
      reduxStore.dispatch(logout());
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [reduxStore]);

  return null;
}

export default function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      <SessionExpiredListener />
      {children}
    </Provider>
  );
}
