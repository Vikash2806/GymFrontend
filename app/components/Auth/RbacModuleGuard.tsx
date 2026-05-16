"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography } from "antd";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { getFirstAccessibleRoute, hasAnyModuleViewForSession, hasModuleAction } from "@/utils/permissions";
import type { PermissionAction } from "@/constants/permissionSchema";
import { isOwnerFromSession } from "@/utils/gymRole";

type Props = {
  /** Single module base key (e.g. `staff_management`). */
  baseKey?: string;
  action?: PermissionAction;
  /** Allow when any listed module has view access. */
  anyViewOf?: string[];
  requireOwner?: boolean;
  fallbackPath?: string;
  children: React.ReactNode;
};

export default function RbacModuleGuard({
  baseKey,
  action = "view",
  anyViewOf,
  requireOwner = false,
  fallbackPath = "/pages/dashboard",
  children
}: Props) {
  const router = useRouter();
  const session = useAppSelector(selectSession);
  const [mounted, setMounted] = useState(false);

  const allowedByPermission = anyViewOf?.length
    ? hasAnyModuleViewForSession(session, anyViewOf)
    : baseKey
      ? hasModuleAction(session, baseKey, action)
      : false;
  const allowedByRole = !requireOwner || isOwnerFromSession(session);
  const allowed = allowedByPermission && allowedByRole;
  const resolvedFallbackPath =
    fallbackPath === "/pages/dashboard" ? getFirstAccessibleRoute(session) : fallbackPath;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!allowed) {
      router.replace(resolvedFallbackPath);
    }
  }, [allowed, resolvedFallbackPath, mounted, router]);

  if (!mounted || !allowed) {
    return <Typography.Text type="secondary">Checking permissions...</Typography.Text>;
  }
  return <>{children}</>;
}
