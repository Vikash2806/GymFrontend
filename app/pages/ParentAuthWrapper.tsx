"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { selectIsLoggedIn } from "@/redux/features/auth/authSlice";
import { Layout, Spin, Typography, theme } from "antd";

const { Text } = Typography;

type Props = {
  children: React.ReactNode;
};

export default function ParentAuthWrapper({ children }: Props) {
  const router = useRouter();
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { token } = theme.useToken();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) {
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
          <Text style={{ color: token.colorTextSecondary, fontSize: 16 }}>
            Checking authentication...
          </Text>
        </div>
      </Layout>
    );
  }

  return <>{children}</>;
}
