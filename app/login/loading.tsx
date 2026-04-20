"use client";

import { Spin } from "antd";

export default function LoginLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Spin size="large" />
    </div>
  );
}
