"use client";

import React, { useState } from "react";
import { Layout, theme } from "antd";
import AppBar from "./components/AppBar/appBar";
import Sidebar from "./components/Sidebar/Sidebar";

type Props = {
  children: React.ReactNode;
};

const DashboardLayout: React.FC<Props> = ({ children }) => {
  const [appBarHeight, setAppBarHeight] = useState(64);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { token } = theme.useToken();

  return (
    <Layout style={{ height: "100vh", overflow: "hidden" }}>
      <AppBar onHeightChange={setAppBarHeight} />
      <Layout style={{ marginTop: appBarHeight, height: `calc(100vh - ${appBarHeight}px)`, display: "flex" }}>
        <Sidebar appBarHeight={appBarHeight} onCollapseChange={setSidebarCollapsed} />
        <Layout
          style={{
            marginLeft: sidebarCollapsed ? 80 : 240,
            flex: 1,
            overflow: "hidden",
            transition: "margin-left 0.2s ease"
          }}
        >
          <Layout.Content
            style={{
              margin: 0,
              padding: 24,
              overflowY: "auto",
              overflowX: "hidden",
              background: token.colorBgLayout,
              height: "100%"
            }}
          >
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;
