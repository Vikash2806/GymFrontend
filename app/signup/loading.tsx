"use client";

import { Spin } from "antd";

export default function SignupLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Spin size="large" />
    </div>
  );
}
