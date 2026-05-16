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
import RbacModuleGuard from "@/app/components/Auth/RbacModuleGuard";
import { FEATURES } from "@/utils/permissions";

export default function ExpensesPage() {
  return (
    <RbacModuleGuard baseKey={FEATURES.EXPENSES} action="view">
      <Card styles={{ body: { paddingTop: 16 } }}>
        <ExpensesPanel />
      </Card>
    </RbacModuleGuard>
  );
}
