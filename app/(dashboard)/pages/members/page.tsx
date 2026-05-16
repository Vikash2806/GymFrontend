"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Badge, Card, Tabs, Spin } from "antd";
import { UserOutlined, IdcardOutlined } from "@ant-design/icons";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { MembersPanelProps } from "./MembersPanel";
import type { MembershipPlansPanelProps } from "./MembershipPlansPanel";
import RbacModuleGuard from "@/app/components/Auth/RbacModuleGuard";
import { FEATURES, getFirstAccessibleRoute, hasModuleAction } from "@/utils/permissions";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import type { Dayjs } from "dayjs";

const panelLoading = (
  <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
    <Spin size="large" />
  </div>
);

const MembersPanel = dynamic<MembersPanelProps>(() => import("./MembersPanel"), {
  loading: () => panelLoading
});

const MembershipPlansPanel = dynamic<MembershipPlansPanelProps>(() => import("./MembershipPlansPanel"), {
  loading: () => panelLoading
});

type MemberDraftFromMemberships = {
  branchId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: Dayjs | null;
  dateOfJoining?: Dayjs;
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  planId?: string;
  paidAmount?: number;
  paymentMethod?: "cash" | "upi" | "card";
  emergencyContacts?: Array<{ name: string; phone: string; relation: string }>;
  notes?: string;
};

function MembersPageContent() {
  const session = useAppSelector(selectSession);
  const canViewMembers = hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "view");
  const canViewPlans = hasModuleAction(session, FEATURES.MEMBERSHIP_PLANS, "view");
  const defaultTab = canViewMembers ? "members" : "memberships";

  const [memberCount, setMemberCount] = useState(0);
  const [membershipCreateRequestId, setMembershipCreateRequestId] = useState(0);
  const [recentlyCreatedPlan, setRecentlyCreatedPlan] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const [memberDraftFromMemberships, setMemberDraftFromMemberships] = useState<MemberDraftFromMemberships | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeKey = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === "memberships" && canViewPlans) {
      return "memberships";
    }
    if (tab === "members" && canViewMembers) {
      return "members";
    }
    return defaultTab;
  }, [searchParams, canViewMembers, canViewPlans, defaultTab]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const wantsMembers = tab === "members" || (!tab && defaultTab === "members");
    const wantsPlans = tab === "memberships" || (!tab && defaultTab === "memberships");
    if (wantsMembers && !canViewMembers && canViewPlans) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "memberships");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    if (wantsPlans && !canViewPlans && canViewMembers) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "members");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    if ((wantsMembers && !canViewMembers) || (wantsPlans && !canViewPlans)) {
      router.replace(getFirstAccessibleRoute(session));
    }
  }, [canViewMembers, canViewPlans, defaultTab, pathname, router, searchParams, session]);

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

  const requestMembershipCreateFromMembers = (draft?: MemberDraftFromMemberships) => {
    if (!canViewPlans) {
      return;
    }
    setMemberDraftFromMemberships(draft ?? null);
    setMembershipCreateRequestId((prev) => prev + 1);
    switchTab("memberships");
  };

  const handlePlanCreatedFromMemberships = (plan: { _id: string; name: string }) => {
    setRecentlyCreatedPlan(plan);
    if (canViewMembers) {
      switchTab("members");
    }
  };

  const tabItems = useMemo(() => {
    const items: Array<{
      key: string;
      label: React.ReactNode;
      children: React.ReactNode;
    }> = [];
    if (canViewMembers) {
      items.push({
        key: "members",
        label: (
          <span>
            <UserOutlined /> Members{" "}
            <Badge count={memberCount} size="small" style={{ marginLeft: 6 }} overflowCount={999} />
          </span>
        ),
        children:
          activeKey === "members" ? (
            <MembersPanel
              onMemberCountChange={setMemberCount}
              onRequestCreateMembershipPlan={canViewPlans ? requestMembershipCreateFromMembers : undefined}
              createdPlanFromMemberships={recentlyCreatedPlan}
              memberDraftFromMemberships={memberDraftFromMemberships}
              onMemberDraftHandled={() => setMemberDraftFromMemberships(null)}
              onCreatedPlanHandled={() => setRecentlyCreatedPlan(null)}
            />
          ) : null
      });
    }
    if (canViewPlans) {
      items.push({
        key: "memberships",
        label: (
          <span>
            <IdcardOutlined /> Membership Plans
          </span>
        ),
        children:
          activeKey === "memberships" ? (
            <MembershipPlansPanel
              createRequestId={membershipCreateRequestId}
              onPlanCreatedFromExternalRequest={handlePlanCreatedFromMemberships}
              onCreateRequestHandled={() => setMembershipCreateRequestId(0)}
            />
          ) : null
      });
    }
    return items;
  }, [
    activeKey,
    canViewMembers,
    canViewPlans,
    memberCount,
    membershipCreateRequestId,
    recentlyCreatedPlan,
    memberDraftFromMemberships
  ]);

  if (tabItems.length === 0) {
    return null;
  }

  if (tabItems.length === 1) {
    return <Card styles={{ body: { paddingTop: 16 } }}>{tabItems[0].children}</Card>;
  }

  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <Tabs activeKey={activeKey} onChange={onTabChange} destroyOnHidden items={tabItems} />
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
      <RbacModuleGuard anyViewOf={[FEATURES.MEMBER_MANAGEMENT, FEATURES.MEMBERSHIP_PLANS]}>
        <MembersPageContent />
      </RbacModuleGuard>
    </Suspense>
  );
}
