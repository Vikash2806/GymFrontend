"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";
import RbacModuleGuard from "@/app/components/Auth/RbacModuleGuard";
import { FEATURES } from "@/utils/permissions";

const DashboardPanel = dynamic(() => import("./DashboardPanel"), {
  loading: () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    </Card>
  )
});

export default function DashboardPage() {
  return (
    <RbacModuleGuard baseKey={FEATURES.DASHBOARD} action="view">
      <Card styles={{ body: { paddingTop: 16 } }}>
        <DashboardPanel />
      </Card>
    </RbacModuleGuard>
  );
}
