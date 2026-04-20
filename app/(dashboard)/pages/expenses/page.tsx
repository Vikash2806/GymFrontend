"use client";

import React from "react";
import { Card } from "antd";
import ExpensesPanel from "./ExpensesPanel";
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
