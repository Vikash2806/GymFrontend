"use client";

import React from "react";
import { Card } from "antd";
import FinancialOverviewPanel from "./FinancialOverviewPanel";
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
