"use client";

import dynamic from "next/dynamic";
import { Spin } from "antd";
import DashboardLayout from "@/app/DashboardLayout";

type DashboardLayoutProps = Readonly<{ children: React.ReactNode }>;

const ParentAuthWrapper = dynamic(() => import("@/app/components/Auth/ParentAuthWrapper"), {
  ssr: false,
  loading: () => <Spin size="large" />
});

export default function DashboardShellLayout({ children }: DashboardLayoutProps) {
  return (
    <ParentAuthWrapper>
      <DashboardLayout>{children}</DashboardLayout>
    </ParentAuthWrapper>
  );
}
