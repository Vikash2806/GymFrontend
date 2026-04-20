"use client";

import { Card, Spin } from "antd";

export default function DashboardPagesLoading() {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    </Card>
  );
}
