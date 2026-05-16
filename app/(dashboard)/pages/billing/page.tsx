"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, Spin } from "antd";
import RbacModuleGuard from "@/app/components/Auth/RbacModuleGuard";
import { FEATURES } from "@/utils/permissions";

const BillingPanel = dynamic(() => import("./BillingPanel"), {
  loading: () => (
    <Card>
      <Spin style={{ display: "block", margin: "48px auto" }} size="large" />
    </Card>
  )
});

export default function BillingPage() {
  return (
    <RbacModuleGuard baseKey={FEATURES.MEMBER_MANAGEMENT} action="view">
      <Card styles={{ body: { paddingTop: 16 } }}>
        <BillingPanel />
      </Card>
    </RbacModuleGuard>
  );
}
