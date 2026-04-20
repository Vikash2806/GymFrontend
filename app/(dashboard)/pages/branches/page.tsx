"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";

const BranchesPanel = dynamic(() => import("./BranchesPanel"), {
  loading: () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    </Card>
  )
});

export default function BranchesPage() {
  return <BranchesPanel />;
}
