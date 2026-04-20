"use client";

import React from "react";
import BranchesPanel from "./BranchesPanel";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

export default function BranchesPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.BRANCH_MANAGEMENT}>
      <BranchesPanel />
    </RbacPermissionGuard>
  );
}
