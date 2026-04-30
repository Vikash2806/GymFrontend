"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Layout, theme } from "antd";
import AppBar from "./components/AppBar/appBar";
import Sidebar from "./components/Sidebar/Sidebar";
import apiClient from "@/utils/api";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { UnsavedChangesProvider, useUnsavedChanges } from "@/contexts/UnsavedChangesContext";
import { DiscardChangesModal } from "@/app/components/common/DiscardChangesModal";

type Props = {
  children: React.ReactNode;
};

const DashboardLayout: React.FC<Props> = ({ children }) => {
  const [appBarHeight, setAppBarHeight] = useState(64);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_DASHBOARD_WARMUP !== "true") {
      return;
    }
    if (!session) {
      return;
    }

    const warmupBranchId = session.activeBranch?.id ?? session.user?.defaults?.branchId ?? "";
    const warmupKey = `dashboard-warmup:${session.user.id}:${warmupBranchId || "all"}`;
    if (sessionStorage.getItem(warmupKey) === "done") {
      return;
    }
    sessionStorage.setItem(warmupKey, "done");

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    let cancelled = false;
    const withTimeout = async (task: () => Promise<unknown>, timeoutMs = 5000) => {
      await Promise.race([
        task(),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, timeoutMs);
        })
      ]);
    };

    const warmupTasks: Array<() => Promise<unknown>> = [
      () =>
        apiClient.get("/gym/staff-users", {
          params: {
            page: 1,
            pageSize: 10,
            role: "all",
            branchId: warmupBranchId || undefined
          }
        }),
      () => apiClient.get("/gym/expense-categories"),
      () => apiClient.get("/gym/expenses", { params: { year, month, page: 1, pageSize: 10 } })
    ];

    const timer = window.setTimeout(() => {
      void (async () => {
        for (const task of warmupTasks) {
          if (cancelled) {
            return;
          }
          try {
            await withTimeout(task);
          } catch {
            // Best-effort warmup only; ignore failures.
          }
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 120);
          });
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session]);

  return (
    <UnsavedChangesProvider>
      <Layout style={{ height: "100vh", overflow: "hidden" }}>
        <AppBar onHeightChange={setAppBarHeight} />
        <Layout style={{ marginTop: appBarHeight, height: `calc(100vh - ${appBarHeight}px)`, display: "flex" }}>
          <Suspense fallback={null}>
            <Sidebar appBarHeight={appBarHeight} onCollapseChange={setSidebarCollapsed} />
          </Suspense>
          <Layout
            style={{
              marginLeft: sidebarCollapsed ? 80 : 240,
              flex: 1,
              overflow: "hidden",
              transition: "margin-left 0.2s ease"
            }}
          >
            <Layout.Content
              style={{
                margin: 0,
                padding: 12,
                overflowY: "auto",
                overflowX: "hidden",
                background: token.colorBgLayout,
                height: "100%"
              }}
            >
              {children}
            </Layout.Content>
          </Layout>
        </Layout>
        <DashboardDiscardChangesModal />
      </Layout>
    </UnsavedChangesProvider>
  );
};

function DashboardDiscardChangesModal() {
  const { showModal, discardAndNavigate, cancelNavigation } = useUnsavedChanges();
  return <DiscardChangesModal open={showModal} onDiscard={discardAndNavigate} onCancel={cancelNavigation} />;
}

export default DashboardLayout;
