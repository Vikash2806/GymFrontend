"use client";

import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";
import SubscriptionPricingPanel from "../../_components/SubscriptionPricingPanel";

export default function SubscriptionPricingPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.SUBSCRIPTION_PRICING} fallbackPath="/pages/dashboard">
      <SubscriptionPricingPanel />
    </RbacPermissionGuard>
  );
}
