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
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

export default function FinancePage() {
  return (
    <RbacPermissionGuard permission={FEATURES.FINANCIAL_OVERVIEW}>
      <Card styles={{ body: { paddingTop: 16 } }}>
        <FinancialOverviewPanel />
      </Card>
    </RbacPermissionGuard>
  );
}
