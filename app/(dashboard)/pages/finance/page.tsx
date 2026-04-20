"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";

const FinancialOverviewPanel = dynamic(() => import("./FinancialOverviewPanel"), {
  loading: () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    </Card>
  )
});

export default function FinancePage() {
  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <FinancialOverviewPanel />
    </Card>
  );
}
