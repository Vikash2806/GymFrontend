"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { logout, selectSession, setSession } from "@/redux/features/auth/authSlice";
import { Layout, Spin, Typography, theme } from "antd";
import type { AppDispatch } from "@/redux/store";
import apiClient from "@/utils/api";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import { getFirstAccessibleRoute } from "@/utils/permissions";

const { Text } = Typography;

type Props = {
  children: React.ReactNode;
};

function AuthLoadingShell({ message }: { message: string }) {
  const { token } = theme.useToken();
  return (
    <Layout
      style={{
        height: "100vh",
        overflow: "hidden",
        backgroundColor: token.colorBgLayout
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 16
        }}
      >
        <Spin size="large" />
        <Text style={{ color: token.colorTextSecondary, fontSize: 16 }}>{message}</Text>
      </div>
    </Layout>
  );
}

export default function ParentAuthWrapper({ children }: Props) {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const session = useSelector(selectSession);
  const [mounted, setMounted] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || verifyingSession || !sessionValid) {
      return;
    }
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path === "/pages/dashboard") {
      const firstAccessibleRoute = getFirstAccessibleRoute(session);
      if (firstAccessibleRoute !== "/pages/dashboard") {
        router.replace(firstAccessibleRoute);
      }
    }
  }, [mounted, verifyingSession, sessionValid, session, router]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let cancelled = false;
    setVerifyingSession(true);

    void (async () => {
      try {
        const { data } = await apiClient.get<SessionPayload>("/auth/me");
        if (!cancelled) {
          dispatch(setSession(data));
          setSessionValid(true);
        }
      } catch {
        if (!cancelled) {
          dispatch(logout());
          setSessionValid(false);
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setVerifyingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, mounted, router]);

  if (!mounted) {
    return <AuthLoadingShell message="Loading..." />;
  }

  if (!sessionValid) {
    return <AuthLoadingShell message="Checking authentication..." />;
  }

  if (verifyingSession) {
    return <AuthLoadingShell message="Verifying session..." />;
  }

  return <>{children}</>;
}
