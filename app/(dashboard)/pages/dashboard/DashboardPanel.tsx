"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  RiseOutlined,
  TeamOutlined,
  WalletOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { fetchCached } from "@/utils/queryCache";
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

const RevenueTrendChart = dynamic(() => import("./RevenueTrendChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spin size="large" />
    </div>
  )
});
const NewMemberJoinTrendChart = dynamic(() => import("./NewMemberJoinTrendChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spin size="large" />
    </div>
  )
});

const { Title, Text } = Typography;

const ALL_MONTHS_VALUE = 0;

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
const MONTH_OPTIONS: { value: number; label: string }[] = [
  { value: ALL_MONTHS_VALUE, label: "All months (until now)" },
  ...MONTHS
];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TOP_N = 5;
const KPI_CARD_HEIGHT = 118;

type ListResponse = { success: boolean; members?: Member[]; total?: number; message?: string };
type MemberJoinTrendResponse = {
  success: boolean;
  trend?: Array<{ month: number; count: number }>;
  period?: { year: number };
  message?: string;
};
type RevenueYearTrendResponse = {
  success: boolean;
  trend?: Array<{ month: number; amount: number }>;
};
type ExpensesYearTrendResponse = {
  success: boolean;
  trend?: Array<{ month: number; amount: number }>;
};

/**
 * Resolve which calendar month should drive the per-month finance overview API call
 * when "All months" is the user's selection. Past years use December (full year);
 * the current year uses the live month so snapshot data (overdue, pending list) stays fresh.
 */
function resolveEffectiveMonth(month: number, year: number): number {
  if (month !== ALL_MONTHS_VALUE) {
    return month;
  }
  const now = new Date();
  if (year === now.getFullYear()) {
    return now.getMonth() + 1;
  }
  if (year > now.getFullYear()) {
    return 1;
  }
  return 12;
}

/** Sum monthly trend amounts up to (and including) `untilMonth`. */
function sumTrendUntil(trend: Array<{ month: number; amount: number }>, untilMonth: number): number {
  let total = 0;
  for (const row of trend) {
    if (row.month <= untilMonth) {
      total += row.amount ?? 0;
    }
  }
  return Math.round(total * 100) / 100;
}

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

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => y - 5 + i);
  }, []);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(ALL_MONTHS_VALUE);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<FinanceOverviewPayload | null>(null);
  const [trendMetric, setTrendMetric] = useState<"revenue" | "members">("revenue");
  const [loadingRevenueTrend, setLoadingRevenueTrend] = useState(false);
  const [revenueTrendData, setRevenueTrendData] = useState<
    { month: number; label: string; amount: number; year: number }[]
  >([]);
  const [loadingExpensesTrend, setLoadingExpensesTrend] = useState(false);
  const [expensesTrendData, setExpensesTrendData] = useState<
    { month: number; amount: number; year: number }[]
  >([]);
  const [loadingMemberTrend, setLoadingMemberTrend] = useState(false);
  const [memberTrendData, setMemberTrendData] = useState<
    { month: number; label: string; count: number; year: number }[]
  >([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const selectedBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const overviewReqSeq = useRef(0);
  const revenueTrendReqSeq = useRef(0);
  const expensesTrendReqSeq = useRef(0);
  const isAllMonths = month === ALL_MONTHS_VALUE;
  const effectiveMonth = useMemo(() => resolveEffectiveMonth(month, year), [month, year]);

  const resolvedBranchForMembers = useMemo(() => {
    return session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  }, [session?.activeBranch?.id, session?.user?.defaults?.branchId]);

  const loadOverview = useCallback(async () => {
    const reqId = ++overviewReqSeq.current;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { year, month: effectiveMonth };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const cacheKey = `finance-overview:${year}:${effectiveMonth}:${selectedBranchId || "all"}`;
      const data = await fetchCached(
        cacheKey,
        async () => (await apiClient.get<FinanceOverviewResponse>("/gym/dashboard/metrics", { params })).data,
        20_000
      );
      if (reqId !== overviewReqSeq.current) {
        return;
      }
      if (data.success && data.overview) {
        setOverview(data.overview);
      } else {
        setOverview(null);
      }
    } catch {
      if (reqId !== overviewReqSeq.current) {
        return;
      }
      setOverview(null);
      message.error("Could not load dashboard metrics.");
    } finally {
      if (reqId === overviewReqSeq.current) {
        setLoading(false);
      }
    }
  }, [year, effectiveMonth, selectedBranchId, message]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadRevenueTrend = useCallback(async () => {
    const reqId = ++revenueTrendReqSeq.current;
    setLoadingRevenueTrend(true);
    try {
      const params: Record<string, string | number> = { year };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const cacheKey = `finance-revenue-trend:${year}:${selectedBranchId || "all"}`;
      const data = await fetchCached(
        cacheKey,
        async () => (await apiClient.get<RevenueYearTrendResponse>("/gym/dashboard/revenue-trend", { params })).data,
        20_000
      );
      if (reqId !== revenueTrendReqSeq.current) {
        return;
      }
      const trendMap = new Map((data.trend ?? []).map((item) => [item.month, item.amount]));
      const nextData = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        label: MONTH_SHORT[index] ?? String(index + 1),
        amount: trendMap.get(index + 1) ?? 0,
        year
      }));
      setRevenueTrendData(nextData);
    } catch {
      if (reqId !== revenueTrendReqSeq.current) {
        return;
      }
      setRevenueTrendData([]);
      message.error("Could not load yearly revenue trend.");
    } finally {
      if (reqId === revenueTrendReqSeq.current) {
        setLoadingRevenueTrend(false);
      }
    }
  }, [year, selectedBranchId, message]);

  useEffect(() => {
    if (trendMetric === "revenue") {
      void loadRevenueTrend();
    }
  }, [trendMetric, loadRevenueTrend]);

  const loadExpensesTrend = useCallback(async () => {
    const reqId = ++expensesTrendReqSeq.current;
    setLoadingExpensesTrend(true);
    try {
      const params: Record<string, string | number> = { year };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const cacheKey = `finance-expenses-trend:${year}:${selectedBranchId || "all"}`;
      const data = await fetchCached(
        cacheKey,
        async () => (await apiClient.get<ExpensesYearTrendResponse>("/gym/dashboard/expenses-trend", { params })).data,
        20_000
      );
      if (reqId !== expensesTrendReqSeq.current) {
        return;
      }
      const trendMap = new Map((data.trend ?? []).map((item) => [item.month, item.amount]));
      const nextData = Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        amount: trendMap.get(index + 1) ?? 0,
        year
      }));
      setExpensesTrendData(nextData);
    } catch {
      if (reqId !== expensesTrendReqSeq.current) {
        return;
      }
      setExpensesTrendData([]);
      message.error("Could not load yearly expenses trend.");
    } finally {
      if (reqId === expensesTrendReqSeq.current) {
        setLoadingExpensesTrend(false);
      }
    }
  }, [year, selectedBranchId, message]);

  // Lazily load yearly trends only when "All months" is selected, so single-month views
  // don't pay an extra round-trip. Revenue trend is also pulled when the chart toggles to it.
  useEffect(() => {
    if (isAllMonths) {
      void loadRevenueTrend();
      void loadExpensesTrend();
    }
  }, [isAllMonths, loadRevenueTrend, loadExpensesTrend]);

  const loadMemberJoinTrend = useCallback(async () => {
    setLoadingMemberTrend(true);
    try {
      const params: Record<string, string | number> = { year };
      if (resolvedBranchForMembers) {
        params.branchId = resolvedBranchForMembers;
      }
      const { data } = await apiClient.get<MemberJoinTrendResponse>("/gym/members/join-trend", { params });
      if (data.success && Array.isArray(data.trend)) {
        setMemberTrendData(
          data.trend.map((item) => ({
            month: item.month,
            label: MONTH_SHORT[item.month - 1] ?? String(item.month),
            count: item.count,
            year
          }))
        );
      } else {
        setMemberTrendData([]);
      }
    } catch {
      setMemberTrendData([]);
      message.error("Could not load monthly joined members trend.");
    } finally {
      setLoadingMemberTrend(false);
    }
  }, [year, resolvedBranchForMembers, message]);

  useEffect(() => {
    if (trendMetric === "members") {
      void loadMemberJoinTrend();
    }
  }, [trendMetric, loadMemberJoinTrend]);

  const loadMemberCount = useCallback(async () => {
    if (!resolvedBranchForMembers) {
      setMemberCount(null);
      return;
    }
    setLoadingMembers(true);
    try {
      const { data } = await apiClient.get<ListResponse>("/gym/members", {
        params: { branchId: resolvedBranchForMembers, page: 1, pageSize: 1 }
      });
      if (data.success && typeof data.total === "number") {
        setMemberCount(data.total);
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

  const periodLabel = useMemo(() => {
    if (isAllMonths) {
      return `All months · ${year}`;
    }
    if (!overview) {
      return "";
    }
    const m = MONTHS.find((x) => x.value === overview.period.month)?.label ?? "";
    return `${m} ${overview.period.year}`;
  }, [isAllMonths, year, overview]);

  // Year-to-date totals when "All months" is selected. Revenue is sourced from the
  // already-cached yearly bar-chart data; expenses come from the sibling year-trend
  // endpoint. Overdue is a snapshot (member-level), so it is reused as-is from the
  // per-month overview response.
  const aggregatedRevenue = useMemo(() => {
    if (!isAllMonths) {
      return null;
    }
    return sumTrendUntil(revenueTrendData, effectiveMonth);
  }, [isAllMonths, revenueTrendData, effectiveMonth]);

  const aggregatedExpenses = useMemo(() => {
    if (!isAllMonths) {
      return null;
    }
    return sumTrendUntil(expensesTrendData, effectiveMonth);
  }, [isAllMonths, expensesTrendData, effectiveMonth]);

  const displayRevenue = isAllMonths ? (aggregatedRevenue ?? 0) : (overview?.totals.revenue ?? 0);
  const displayExpenses = isAllMonths ? (aggregatedExpenses ?? 0) : (overview?.totals.expenses ?? 0);
  const revenueCardLoading = isAllMonths ? loadingRevenueTrend && revenueTrendData.length === 0 : loading;
  const expensesCardLoading = isAllMonths ? loadingExpensesTrend && expensesTrendData.length === 0 : loading;

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
  const chartLoading = trendMetric === "revenue" ? loadingRevenueTrend : loadingMemberTrend;
  const chartTitle = trendMetric === "revenue" ? "Monthly revenue trends" : "Monthly new members joined";
  const chartEmpty =
    trendMetric === "revenue"
      ? "No monthly revenue data for this year"
      : "No monthly joined member data for this year";

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
          <Select
            style={{ width: 120 }}
            value={year}
            onChange={setYear}
            options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
          />
          <Select
            style={{ width: 180 }}
            value={month}
            onChange={setMonth}
            options={MONTH_OPTIONS}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card loading={revenueCardLoading} style={{ width: "100%", height: "100%" }} styles={{ body: { padding: 18, minHeight: KPI_CARD_HEIGHT } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#22c55e", <RiseOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Revenue ({periodLabel || "period"})</Text>
                <Statistic
                  value={displayRevenue}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card loading={expensesCardLoading} style={{ width: "100%", height: "100%" }} styles={{ body: { padding: 18, minHeight: KPI_CARD_HEIGHT } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#ef4444", <WalletOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Expenses</Text>
                <Statistic
                  value={displayExpenses}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card loading={loading} style={{ width: "100%", height: "100%" }} styles={{ body: { padding: 18, minHeight: KPI_CARD_HEIGHT } }}>
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
        <Col xs={24} sm={12} lg={6} style={{ display: "flex" }}>
          <Card
            loading={loading || loadingMembers}
            style={{ width: "100%", height: "100%" }}
            styles={{ body: { padding: 18, minHeight: KPI_CARD_HEIGHT } }}
          >
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#3b82f6", <TeamOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Members (branch)</Text>
                <Statistic
                  value={memberCount ?? "—"}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {`Scoped to ${session?.activeBranch?.name ?? "active branch"}`}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            loading={chartLoading}
            styles={{ body: { paddingTop: 12 } }}
            title={
              <Space
                align="center"
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <div>
                  <Title level={5} style={{ margin: 0 }}>
                    {chartTitle}
                  </Title>
                  <Text type="secondary">Year {year}</Text>
                </div>
                <Select
                  value={trendMetric}
                  style={{ width: 220 }}
                  onChange={(v) => setTrendMetric(v)}
                  options={[
                    { value: "revenue", label: "Revenue trend" },
                    { value: "members", label: "New members joined" }
                  ]}
                />
              </Space>
            }
          >
            {(trendMetric === "revenue" ? revenueTrendData.length : memberTrendData.length) > 0 ? (
              trendMetric === "revenue" ? (
                <RevenueTrendChart
                  chartData={revenueTrendData}
                  gridStroke={token.colorBorderSecondary}
                  height={220}
                />
              ) : (
                <NewMemberJoinTrendChart
                  chartData={memberTrendData}
                  gridStroke={token.colorBorderSecondary}
                  height={220}
                />
              )
            ) : (
              <Empty description={chartEmpty} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10} style={{ display: "flex" }}>
          <Card
            loading={loading}
            style={{ width: "100%", height: "100%" }}
            title={
              <Space>
                <Title level={5} style={{ margin: 0 }}>
                  Pending collection
                </Title>
                <Text type="secondary">(first {TOP_N})</Text>
              </Space>
            }
            extra={
              <Link href="/pages/members?filter=overdue">
                <Button type="link" icon={<WalletOutlined />}>
                  Members <ArrowRightOutlined />
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
                scroll={{ x: 560 }}
                tableLayout="fixed"
              />
            ) : (
              <Empty description="No pending members in this list" />
            )}
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
        <Col xs={24}>
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
          >
            {paymentsPreview.length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                columns={paymentsColumns}
                dataSource={paymentsPreview}
                scroll={{ x: 520 }}
                tableLayout="fixed"
              />
            ) : (
              <Empty description="No payments this period" />
            )}
          </Card>
        </Col>
      </Row>

    </div>
  );
}
