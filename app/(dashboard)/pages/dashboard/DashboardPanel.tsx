"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  FundOutlined,
  RiseOutlined,
  TeamOutlined,
  WalletOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { formatInr } from "@/utils/formatCurrency";
import type {
  FinanceOverviewPayload,
  FinanceOverviewResponse,
  PaymentThisMonthRow,
  PendingMemberRow
} from "@/types/finance";
import type { Member } from "@/types/member";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { gymMembershipRoleFromSession } from "@/utils/gymRole";

const RevenueTrendChart = dynamic(() => import("../finance/RevenueTrendChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spin size="large" />
    </div>
  )
});

const { Title, Text } = Typography;

const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const TOP_N = 5;

type ListResponse = { success: boolean; members?: Member[]; message?: string };

function kpiIconWrap(bg: string, icon: React.ReactNode) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        color: "#fff"
      }}
    >
      {icon}
    </div>
  );
}

export default function DashboardPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const role = gymMembershipRoleFromSession(session);
  const isOwner = role === "owner";

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => y - 5 + i);
  }, []);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<FinanceOverviewPayload | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const branchOptions = useMemo(() => {
    const br = session?.gym?.branches ?? [];
    return br.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  }, [session?.gym?.branches]);

  const resolvedBranchForMembers = useMemo(() => {
    if (isOwner) {
      return branchId ?? session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
    }
    return session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  }, [isOwner, branchId, session?.activeBranch?.id, session?.user?.defaults?.branchId]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { year, month };
      if (isOwner && branchId) {
        params.branchId = branchId;
      }
      const { data } = await apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params });
      if (data.success && data.overview) {
        setOverview(data.overview);
      } else {
        setOverview(null);
      }
    } catch {
      setOverview(null);
      message.error("Could not load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [year, month, branchId, isOwner, message]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadMemberCount = useCallback(async () => {
    if (!resolvedBranchForMembers) {
      setMemberCount(null);
      return;
    }
    setLoadingMembers(true);
    try {
      const { data } = await apiClient.get<ListResponse>("/gym/members", {
        params: { branchId: resolvedBranchForMembers }
      });
      if (data.success && Array.isArray(data.members)) {
        setMemberCount(data.members.length);
      } else {
        setMemberCount(null);
      }
    } catch {
      setMemberCount(null);
    } finally {
      setLoadingMembers(false);
    }
  }, [resolvedBranchForMembers]);

  useEffect(() => {
    void loadMemberCount();
  }, [loadMemberCount]);

  const chartData = useMemo(() => {
    if (!overview) {
      return [];
    }
    return overview.revenueByDay.map((d) => ({
      day: d.day,
      label: String(d.day),
      amount: d.amount
    }));
  }, [overview]);

  const periodLabel = useMemo(() => {
    if (!overview) {
      return "";
    }
    const m = MONTHS.find((x) => x.value === overview.period.month)?.label ?? "";
    return `${m} ${overview.period.year}`;
  }, [overview]);

  const paymentsColumns: ColumnsType<PaymentThisMonthRow> = useMemo(
    () => [
      { title: "Member", dataIndex: "memberName", key: "memberName", ellipsis: true },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        width: 120,
        align: "right" as const,
        render: (a: number) => formatInr(a)
      },
      {
        title: "Paid",
        dataIndex: "paidAt",
        key: "paidAt",
        width: 110,
        render: (iso: string) => (iso ? dayjs(iso).format("DD MMM") : "—")
      }
    ],
    []
  );

  const pendingColumns: ColumnsType<PendingMemberRow> = useMemo(
    () => [
      { title: "Member", dataIndex: "name", key: "name", ellipsis: true },
      { title: "Plan", dataIndex: "planName", key: "planName", ellipsis: true },
      {
        title: "Pending",
        dataIndex: "pendingAmount",
        key: "pendingAmount",
        width: 120,
        align: "right" as const,
        render: (a: number) => formatInr(a)
      }
    ],
    []
  );

  const paymentsPreview = overview?.paymentsThisMonth.slice(0, TOP_N) ?? [];
  const pendingPreview = overview?.pendingMembers.slice(0, TOP_N) ?? [];

  const gymName = session?.gym?.name ?? "Your gym";

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Dashboard
          </Title>
          <Text type="secondary">Welcome back — {gymName}</Text>
        </div>
        <Space wrap>
          {isOwner ? (
            <Select
              allowClear
              placeholder="All branches"
              style={{ minWidth: 200 }}
              options={branchOptions}
              value={branchId}
              onChange={(v) => setBranchId(v)}
            />
          ) : null}
          <Select
            style={{ width: 120 }}
            value={year}
            onChange={setYear}
            options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
          />
          <Select
            style={{ width: 140 }}
            value={month}
            onChange={setMonth}
            options={MONTHS.map((m) => ({ value: m.value, label: m.label }))}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} styles={{ body: { padding: 18 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#22c55e", <RiseOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Revenue ({periodLabel || "period"})</Text>
                <Statistic
                  value={overview?.totals.revenue ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} styles={{ body: { padding: 18 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#ef4444", <WalletOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Expenses</Text>
                <Statistic
                  value={overview?.totals.expenses ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} styles={{ body: { padding: 18 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#f97316", <ClockCircleOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Overdue</Text>
                <Statistic
                  value={overview?.totals.overdue ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading || loadingMembers} styles={{ body: { padding: 18 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#3b82f6", <TeamOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Members (branch)</Text>
                <Statistic
                  value={memberCount ?? "—"}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {isOwner && !branchId
                    ? `Scoped to ${session?.activeBranch?.name ?? "active branch"}`
                    : "Listed members for selected branch"}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            loading={loading}
            styles={{ body: { paddingTop: 12 } }}
            title={
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  Revenue trend
                </Title>
                <Text type="secondary">{periodLabel || "Selected period"}</Text>
              </div>
            }
          >
            {chartData.length > 0 ? (
              <RevenueTrendChart chartData={chartData} gridStroke={token.colorBorderSecondary} height={220} />
            ) : (
              <Empty description="No revenue data for this period" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                Attendance
              </Title>
            }
            styles={{ body: { paddingTop: 12 } }}
          >
            <Text type="secondary">Check-ins and attendance tracking will appear here once the module is available.</Text>
          </Card>
        </Col>
      </Row>

      {overview && overview.pendingSummary.totalMembers > 0 ? (
        <Card size="small" style={{ marginTop: 16 }} styles={{ body: { padding: "12px 16px" } }}>
          <Space wrap size="large">
            <Text>
              <Text strong>{overview.pendingSummary.totalMembers}</Text> members with pending payment
            </Text>
            <Text>
              Total pending: <Text strong>{formatInr(overview.pendingSummary.totalPending)}</Text>
            </Text>
            <Text type="secondary">
              Avg pending: {formatInr(overview.pendingSummary.averagePending)}
            </Text>
          </Space>
        </Card>
      ) : null}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            title={
              <Space>
                <Title level={5} style={{ margin: 0 }}>
                  Recent payments
                </Title>
                <Text type="secondary">(first {TOP_N})</Text>
              </Space>
            }
            extra={
              <Link href="/pages/finance">
                <Button type="link" icon={<FundOutlined />}>
                  Financial overview <ArrowRightOutlined />
                </Button>
              </Link>
            }
          >
            {paymentsPreview.length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                columns={paymentsColumns}
                dataSource={paymentsPreview}
              />
            ) : (
              <Empty description="No payments this period" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            loading={loading}
            title={
              <Space>
                <Title level={5} style={{ margin: 0 }}>
                  Pending collection
                </Title>
                <Text type="secondary">(first {TOP_N})</Text>
              </Space>
            }
            extra={
              <Link href="/pages/billing">
                <Button type="link" icon={<WalletOutlined />}>
                  Billing <ArrowRightOutlined />
                </Button>
              </Link>
            }
          >
            {pendingPreview.length > 0 ? (
              <Table
                size="small"
                rowKey="memberId"
                pagination={false}
                columns={pendingColumns}
                dataSource={pendingPreview}
              />
            ) : (
              <Empty description="No pending members in this list" />
            )}
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginTop: 20 }}>
        <Link href="/pages/members">
          <Button type="default">Members</Button>
        </Link>
        <Link href="/pages/billing">
          <Button type="default">Billing</Button>
        </Link>
        <Link href="/pages/finance">
          <Button type="default">Financial overview</Button>
        </Link>
        <Link href="/pages/expenses">
          <Button type="default">Expenses</Button>
        </Link>
      </Space>
    </div>
  );
}
