"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Typography } from "antd";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { canAccessRoute, getFirstAccessibleRouteFromAccess } from "@/utils/routeAccess";

type Props = {
  children: React.ReactNode;
};

/**
 * Enforces Role Master permissions for dashboard URLs (sidebar + direct navigation).
 */
export default function DashboardRouteGuard({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAppSelector(selectSession);
  const [mounted, setMounted] = useState(false);

  const allowed = canAccessRoute(pathname, session);
  const fallbackPath = getFirstAccessibleRouteFromAccess(session);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !session) {
      return;
    }
    if (!allowed) {
      router.replace(fallbackPath);
    }
  }, [allowed, fallbackPath, mounted, router, session]);

  if (!mounted || !session || !allowed) {
    return <Typography.Text type="secondary">Checking permissions...</Typography.Text>;
  }

  return <>{children}</>;
}
