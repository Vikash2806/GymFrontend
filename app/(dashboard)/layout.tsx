"use client";

import { Layout, Typography } from "antd";

const { Header, Content } = Layout;

type DashboardLayoutProps = Readonly<{ children: React.ReactNode }>;

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#001529",
          color: "#fff",
          display: "flex",
          alignItems: "center"
        }}
      >
        <Typography.Text style={{ color: "#fff", fontWeight: 600 }}>
          Gym Admin
        </Typography.Text>
      </Header>
      <Content style={{ padding: 24 }}>{children}</Content>
    </Layout>
  );
}
