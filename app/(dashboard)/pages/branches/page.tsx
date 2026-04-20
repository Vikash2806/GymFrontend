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
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

export default function BranchesPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.BRANCH_MANAGEMENT}>
      <BranchesPanel />
    </RbacPermissionGuard>
  );
}
