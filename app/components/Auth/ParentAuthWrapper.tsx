"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { Spin } from "antd";
import { selectIsLoggedIn, selectSession, setSession } from "@/redux/features/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import apiClient from "@/utils/api";
import { handleSessionExpired } from "@/utils/authSession";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { canAccessRoute, getFirstAccessibleRouteFromAccess } from "@/utils/routeAccess";

type Props = {
  children: React.ReactNode;
};

export default function ParentAuthWrapper({ children }: Props) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const session = useSelector(selectSession);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const pathname = window.location.pathname;
    if (!canAccessRoute(pathname, session)) {
      router.replace(getFirstAccessibleRouteFromAccess(session));
    }
  }, [router, session]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    void (async () => {
      setVerifying(true);
      try {
        const { data } = await apiClient.get<SessionPayload>("/auth/me");
        if (!cancelled) {
          dispatch(setSession(data));
        }
      } catch {
        if (!cancelled) {
          handleSessionExpired();
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn, router]);

  if (!isLoggedIn) {
    return null;
  }

  if (verifying) {
    return (
      <AuthVerifyingLayout>
        <Spin size="large" tip="Verifying session…">
          <div style={{ minHeight: 64, minWidth: 160 }} aria-hidden />
        </Spin>
      </AuthVerifyingLayout>
    );
  }

  return <>{children}</>;
}

function AuthVerifyingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh"
      }}
    >
      {children}
    </div>
  );
}
