"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { logout, selectSession, setSession } from "@/redux/features/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import apiClient from "@/utils/api";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { getFirstAccessibleRoute } from "@/utils/permissions";

type Props = {
  children: React.ReactNode;
};

export default function ParentAuthWrapper({ children }: Props) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const session = useSelector(selectSession);

  useEffect(() => {
    if (!session) {
      return;
    }
    const firstAccessibleRoute = getFirstAccessibleRoute(session);
    if (typeof window !== "undefined" && window.location.pathname === "/pages/dashboard") {
      if (firstAccessibleRoute !== "/pages/dashboard") {
        router.replace(firstAccessibleRoute);
      }
    }
  }, [router, session]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { data } = await apiClient.get<SessionPayload>("/auth/me");
        if (!cancelled) {
          dispatch(setSession(data));
        }
      } catch {
        if (!cancelled) {
          dispatch(logout());
          router.replace("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, router]);

  return <>{children}</>;
}
