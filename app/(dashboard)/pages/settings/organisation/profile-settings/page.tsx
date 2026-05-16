"use client";

import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";
import ProfileSettingsPanel from "../../_components/ProfileSettingsPanel";

export default function ProfileSettingsPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.SETTINGS} fallbackPath="/pages/dashboard">
      <ProfileSettingsPanel />
    </RbacPermissionGuard>
  );
}
