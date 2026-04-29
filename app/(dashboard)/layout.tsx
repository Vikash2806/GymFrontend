import DashboardLayout from "@/app/DashboardLayout";
import ParentAuthWrapper from "@/app/components/Auth/ParentAuthWrapper";

type DashboardLayoutProps = Readonly<{ children: React.ReactNode }>;

export default function DashboardShellLayout({ children }: DashboardLayoutProps) {
  return (
    <ParentAuthWrapper>
      <DashboardLayout>{children}</DashboardLayout>
    </ParentAuthWrapper>
  );
}
