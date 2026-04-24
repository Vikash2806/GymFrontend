"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

const TransactionsPanel = dynamic(() => import("./TransactionsPanel"), {
  loading: () => (
    <Card>
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    </Card>
  )
});

export default function TransactionsPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.BILLING_DASHBOARD}>
      <Card styles={{ body: { paddingTop: 16 } }}>
        <TransactionsPanel />
      </Card>
    </RbacPermissionGuard>
  );
}

