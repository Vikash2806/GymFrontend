"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { logout, selectIsLoggedIn, setSession } from "@/redux/features/auth/authSlice";
import { Layout, Spin, Typography, theme } from "antd";
import type { AppDispatch } from "@/redux/store";
import apiClient from "@/utils/api";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";

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
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [mounted, setMounted] = useState(false);
  const [verifyingSession, setVerifyingSession] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, router, mounted]);

  useEffect(() => {
    if (!mounted || !isLoggedIn) {
      return;
    }

    let cancelled = false;
    setVerifyingSession(true);

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
      } finally {
        if (!cancelled) {
          setVerifyingSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, isLoggedIn, mounted, router]);

  if (!mounted) {
    return <AuthLoadingShell message="Loading..." />;
  }

  if (!isLoggedIn) {
    return <AuthLoadingShell message="Checking authentication..." />;
  }

  if (verifyingSession) {
    return <AuthLoadingShell message="Verifying session..." />;
  }

  return <>{children}</>;
}
