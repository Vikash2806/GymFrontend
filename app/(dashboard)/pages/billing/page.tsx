"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";

const BillingPanel = dynamic(() => import("./BillingPanel"), {
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

export default function BillingPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.BILLING_DASHBOARD}>
      <Card styles={{ body: { paddingTop: 16 } }}>
        <BillingPanel />
      </Card>
    </RbacPermissionGuard>
  );
}
