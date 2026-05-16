"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";
import RbacModuleGuard from "@/app/components/Auth/RbacModuleGuard";
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
    <RbacModuleGuard anyViewOf={[FEATURES.MEMBER_MANAGEMENT, FEATURES.TRANSACTIONS]}>
      <Card styles={{ body: { paddingTop: 16 } }}>
        <TransactionsPanel />
      </Card>
    </RbacModuleGuard>
  );
}