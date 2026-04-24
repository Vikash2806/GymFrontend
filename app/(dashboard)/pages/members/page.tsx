"use client";

import React, { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Badge, Card, Tabs, Spin } from "antd";
import { UserOutlined, IdcardOutlined } from "@ant-design/icons";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { MembersPanelProps } from "./MembersPanel";
import type { MembershipPlansPanelProps } from "./MembershipPlansPanel";

const MembersPanel = dynamic<MembersPanelProps>(() => import("./MembersPanel"), {
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  )
});

const MembershipPlansPanel = dynamic<MembershipPlansPanelProps>(() => import("./MembershipPlansPanel"), {
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  )
});
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

function MembersPageContent() {
  const [memberCount, setMemberCount] = useState(0);
  const [membershipCreateRequestId, setMembershipCreateRequestId] = useState(0);
  const [recentlyCreatedPlan, setRecentlyCreatedPlan] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeKey = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === "memberships" || tab === "members") {
      return tab;
    }
    return "members";
  }, [searchParams]);

  const switchTab = (key: "members" | "memberships") => {
    if (key === activeKey) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const onTabChange = (key: string) => {
    if (key === "members" || key === "memberships") {
      switchTab(key);
    }
  };

  const requestMembershipCreateFromMembers = () => {
    setMembershipCreateRequestId((prev) => prev + 1);
    switchTab("memberships");
  };

  const handlePlanCreatedFromMemberships = (plan: { _id: string; name: string }) => {
    setRecentlyCreatedPlan(plan);
    switchTab("members");
  };

  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <Tabs
        activeKey={activeKey}
        onChange={onTabChange}
        destroyOnHidden
        items={[
          {
            key: "members",
            label: (
              <span>
                <UserOutlined /> Members{" "}
                <Badge count={memberCount} size="small" style={{ marginLeft: 6 }} overflowCount={999} />
              </span>
            ),
            children: activeKey === "members" ? (
              <MembersPanel
                onMemberCountChange={setMemberCount}
                onRequestCreateMembershipPlan={requestMembershipCreateFromMembers}
                createdPlanFromMemberships={recentlyCreatedPlan}
                onCreatedPlanHandled={() => setRecentlyCreatedPlan(null)}
              />
            ) : null
          },
          {
            key: "memberships",
            label: (
              <span>
                <IdcardOutlined /> Memberships
              </span>
            ),
            children: activeKey === "memberships" ? (
              <MembershipPlansPanel
                createRequestId={membershipCreateRequestId}
                onPlanCreatedFromExternalRequest={handlePlanCreatedFromMemberships}
              />
            ) : null
          }
        ]}
      />
    </Card>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        </Card>
      }
    >
      <RbacPermissionGuard permission={FEATURES.MEMBER_MANAGEMENT}>
        <MembersPageContent />
      </RbacPermissionGuard>
    </Suspense>
  );
}
