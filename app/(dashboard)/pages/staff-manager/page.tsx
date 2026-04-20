"use client";

import React from "react";
import StaffManagerPanel from "./StaffManagerPanel";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

export default function StaffManagerPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.STAFF_MANAGEMENT}>
      <StaffManagerPanel />
    </RbacPermissionGuard>
  );
}
