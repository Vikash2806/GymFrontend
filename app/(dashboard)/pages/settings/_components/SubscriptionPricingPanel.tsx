"use client";

import { useEffect, useState } from "react";
import { App, Button, Card, Progress, Space } from "antd";
import Link from "next/link";
import apiClient from "@/utils/api";
import type { GymUsageSnapshotResponse } from "@/types/usage";

type CurrentGymPlanResponse = {
  success: boolean;
  gymSubscription?: {
    planName?: string;
    startDate?: string | null;
    endDate?: string | null;
    billingStart?: string | null;
    billingEnd?: string | null;
  };
};

type UsageView = {
  key: "members" | "users" | "branches" | "expenses";
  label: string;
  current: number;
  max: number;
};

function formatDateLabel(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString("en-GB");
}

export default function SubscriptionPricingPanel() {
  const { message } = App.useApp();
  const [planLoading, setPlanLoading] = useState(false);
  const [currentPlanName, setCurrentPlanName] = useState<string>("free");
  const [currentPlanStartAt, setCurrentPlanStartAt] = useState<string | null>(null);
  const [currentPlanEndAt, setCurrentPlanEndAt] = useState<string | null>(null);
  const [usageRows, setUsageRows] = useState<UsageView[]>([]);

  useEffect(() => {
    const loadCurrentPlan = async () => {
      setPlanLoading(true);
      try {
        const [{ data: planData }, { data: usageData }] = await Promise.all([
          apiClient.get<CurrentGymPlanResponse>("/gym/pricing-plans/current-gym-plan"),
          apiClient.get<GymUsageSnapshotResponse>("/gym/usage/check")
        ]);
        if (!planData.success) {
          return;
        }
        const planName = planData.gymSubscription?.planName ?? "free";
        const planStart = planData.gymSubscription?.billingStart ?? planData.gymSubscription?.startDate ?? null;
        const planEnd = planData.gymSubscription?.billingEnd ?? planData.gymSubscription?.endDate ?? null;
        setCurrentPlanName(planName);
        setCurrentPlanStartAt(planStart);
        setCurrentPlanEndAt(planEnd);
        if (usageData.success && usageData.usage) {
          setUsageRows([
            {
              key: "members",
              label: "Members",
              current: usageData.usage.members,
              max: usageData.usage.maxMembers
            },
            {
              key: "users",
              label: "Users",
              current: usageData.usage.users,
              max: usageData.usage.maxUsers
            },
            {
              key: "branches",
              label: "Branches",
              current: usageData.usage.branches,
              max: usageData.usage.maxBranches
            },
            {
              key: "expenses",
              label: "Expenses",
              current: usageData.usage.expenses,
              max: usageData.usage.maxExpenses
            }
          ]);
        } else {
          setUsageRows([]);
        }
      } catch {
        message.error("Could not load current plan details.");
      } finally {
        setPlanLoading(false);
      }
    };
    void loadCurrentPlan();
  }, [message]);

  return (
    <Card title="Subscription & Pricing">
      <Space direction="vertical" size={12}>
        <p>Manage your gym subscription, compare plans, and upgrade instantly.</p>
        <div>
          <div>
            <strong>Current plan:</strong> {currentPlanName.toUpperCase()}
          </div>
          <div>
            <strong>Started at:</strong> {planLoading ? "Loading..." : formatDateLabel(currentPlanStartAt)}
          </div>
          <div>
            <strong>Expires at:</strong> {planLoading ? "Loading..." : formatDateLabel(currentPlanEndAt)}
          </div>
        </div>
        <div>
          <strong>Usage</strong>
          <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
            {usageRows.map((row) => {
              const max = row.max > 0 ? row.max : 1;
              const percent = Math.min(100, Math.round((row.current / max) * 100));
              return (
                <div key={row.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{row.label}</span>
                    <span>
                      {row.current} / {row.max}
                    </span>
                  </div>
                  <Progress percent={percent} size="small" showInfo={false} />
                </div>
              );
            })}
          </Space>
        </div>
        <Button type="primary">
          <Link href="/pricing?from=subscription">Manage / Upgrade Plan</Link>
        </Button>
      </Space>
    </Card>
  );
}
