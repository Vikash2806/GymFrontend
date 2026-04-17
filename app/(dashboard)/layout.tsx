"use client";

import ParentAuthWrapper from "@/app/pages/ParentAuthWrapper";
import DashboardLayout from "@/app/DashboardLayout";

type DashboardLayoutProps = Readonly<{ children: React.ReactNode }>;

export default function DashboardShellLayout({ children }: DashboardLayoutProps) {
  return (
    <ParentAuthWrapper>
      <DashboardLayout>{children}</DashboardLayout>
    </ParentAuthWrapper>
  );
}
