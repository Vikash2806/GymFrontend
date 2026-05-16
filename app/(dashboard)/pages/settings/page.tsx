"use client";

import { Suspense, useEffect } from "react";
import { Spin } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { FEATURES, getFirstAccessibleRoute, hasFeature } from "@/utils/permissions";
import {
  getFirstAccessibleSettingsRoute,
  hasAnySettingsView,
  SETTINGS_ROUTES
} from "./settingsRoutes";

function SettingsIndexRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useAppSelector(selectSession);

  useEffect(() => {
    if (!hasAnySettingsView(session)) {
      router.replace(getFirstAccessibleRoute(session));
      return;
    }
    const tab = searchParams.get("tab");
    if (tab === "gym" && hasFeature(session, FEATURES.GYM_PROFILE)) {
      router.replace(SETTINGS_ROUTES.gym);
      return;
    }
    if (tab === "pricing" && hasFeature(session, FEATURES.SUBSCRIPTION_PRICING)) {
      router.replace(SETTINGS_ROUTES.subscription);
      return;
    }
    const target = getFirstAccessibleSettingsRoute(session) ?? getFirstAccessibleRoute(session);
    router.replace(target);
  }, [router, searchParams, session]);

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  );
}

export default function SettingsIndexPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      }
    >
      <SettingsIndexRedirect />
    </Suspense>
  );
}
