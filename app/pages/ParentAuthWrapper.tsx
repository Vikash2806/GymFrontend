"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { selectIsLoggedIn } from "@/redux/features/auth/authSlice";
import { Layout, Spin, Typography, theme } from "antd";

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
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [mounted, setMounted] = useState(false);

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

  if (!mounted) {
    return <AuthLoadingShell message="Loading..." />;
  }

  if (!isLoggedIn) {
    return <AuthLoadingShell message="Checking authentication..." />;
  }

  return <>{children}</>;
}
