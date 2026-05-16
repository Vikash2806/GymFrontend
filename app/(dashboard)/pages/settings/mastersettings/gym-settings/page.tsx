"use client";

import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";
import GymSettingsPanel from "../../_components/GymSettingsPanel";

export default function GymSettingsPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.GYM_PROFILE} fallbackPath="/pages/dashboard">
      <GymSettingsPanel />
    </RbacPermissionGuard>
  );
}
