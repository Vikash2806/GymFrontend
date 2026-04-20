"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";

const ExpensesPanel = dynamic(() => import("./ExpensesPanel"), {
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

export default function ExpensesPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.EXPENSES}>
      <Card styles={{ body: { paddingTop: 16 } }}>
        <ExpensesPanel />
      </Card>
    </RbacPermissionGuard>
  );
}
