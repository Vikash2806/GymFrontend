"use client";

import React, { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Badge, Card, Tabs, Spin } from "antd";
import { UserOutlined, IdcardOutlined } from "@ant-design/icons";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

const MembersPanel = dynamic(() => import("./MembersPanel"), {
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  )
});

const MembershipPlansPanel = dynamic(() => import("./MembershipPlansPanel"), {
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
      <Spin size="large" />
    </div>
  )
});

function MembersPageContent() {
  const [memberCount, setMemberCount] = useState(0);
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

  const onTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <Tabs
        activeKey={activeKey}
        onChange={onTabChange}
        items={[
          {
            key: "members",
            label: (
              <span>
                <UserOutlined /> Members{" "}
                <Badge count={memberCount} size="small" style={{ marginLeft: 6 }} overflowCount={999} />
              </span>
            ),
            children: <MembersPanel onMemberCountChange={setMemberCount} />
          },
          {
            key: "memberships",
            label: (
              <span>
                <IdcardOutlined /> Memberships
              </span>
            ),
            children: <MembershipPlansPanel />
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
      <MembersPageContent />
    </Suspense>
  );
}
