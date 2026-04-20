"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography } from "antd";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { hasPermission, type Permission } from "@/utils/permissions";
import { isOwnerFromSession } from "@/utils/gymRole";

type Props = {
  permission: Permission;
  requireOwner?: boolean;
  fallbackPath?: string;
  children: React.ReactNode;
};

export default function RbacPermissionGuard({
  permission,
  requireOwner = false,
  fallbackPath = "/pages/dashboard",
  children
}: Props) {
  const router = useRouter();
  const session = useAppSelector(selectSession);
  const [mounted, setMounted] = useState(false);
  const allowedByPermission = hasPermission(session, permission);
  const allowedByRole = !requireOwner || isOwnerFromSession(session);
  const allowed = allowedByPermission && allowedByRole;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (!allowed) {
      router.replace(fallbackPath);
    }
  }, [allowed, fallbackPath, mounted, router]);

  if (!mounted || !allowed) {
    return <Typography.Text type="secondary">Checking permissions...</Typography.Text>;
  }
  return <>{children}</>;
}
