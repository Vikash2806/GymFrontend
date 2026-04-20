"use client";

import React from "react";
import { Card } from "antd";
import BillingPanel from "./BillingPanel";
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
