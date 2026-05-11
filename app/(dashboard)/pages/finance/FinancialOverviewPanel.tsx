"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  App,
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
import {
  ArrowUpOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  WalletOutlined
} from "@ant-design/icons";
import apiClient from "@/utils/api";
import { fetchCached } from "@/utils/queryCache";
import { formatInr } from "@/utils/formatCurrency";
import type { FinanceOverviewPayload, FinanceOverviewResponse } from "@/types/finance";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import ExportButton from "@/app/components/Export/ExportButton";

const RevenueTrendChart = dynamic(() => import("./RevenueTrendChart"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
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

export default function FinancialOverviewPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => y - 5 + i);
  }, []);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPaymentsCard, setLoadingPaymentsCard] = useState(false);
  const [loadingPendingCard, setLoadingPendingCard] = useState(false);
  const [overview, setOverview] = useState<FinanceOverviewPayload | null>(null);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(10);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);
  const [loadingRevenueTrend, setLoadingRevenueTrend] = useState(false);
  const [revenueTrendData, setRevenueTrendData] = useState<
    { month: number; label: string; amount: number; year: number }[]
  >([]);
  const [loadingExpensesTrend, setLoadingExpensesTrend] = useState(false);
  const [expensesTrendData, setExpensesTrendData] = useState<
    { month: number; amount: number; year: number }[]
  >([]);
  const overviewReady = overview !== null;
  const selectedBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const overviewReqSeq = useRef(0);
  const paymentsReqSeq = useRef(0);
  const pendingReqSeq = useRef(0);
  const revenueTrendReqSeq = useRef(0);
  const expensesTrendReqSeq = useRef(0);
  const isAllMonths = month === ALL_MONTHS_VALUE;
  const effectiveMonth = useMemo(() => resolveEffectiveMonth(month, year), [month, year]);

  const loadOverview = useCallback(async () => {
    const reqId = ++overviewReqSeq.current;
    setLoadingOverview(true);
    try {
      const params: Record<string, string | number> = { year, month: effectiveMonth };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const cacheKey = `finance-overview:${year}:${effectiveMonth}:${selectedBranchId || "all"}`;
      const data = await fetchCached(
        cacheKey,
        async () => (await apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params })).data,
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
      message.error("Could not load financial overview.");
    } finally {
      if (reqId === overviewReqSeq.current) {
        setLoadingOverview(false);
      }
    }
  }, [year, effectiveMonth, selectedBranchId, message]);

  useEffect(() => {
    setPaymentsPage(1);
    setPendingPage(1);
  }, [year, effectiveMonth, selectedBranchId]);

  useEffect(() => {
    void loadOverview();
  }, [year, effectiveMonth, selectedBranchId, loadOverview]);

  const loadPaymentsPage = useCallback(async () => {
    const reqId = ++paymentsReqSeq.current;
    setLoadingPaymentsCard(true);
    try {
      const params: Record<string, string | number> = {
        year,
        month: effectiveMonth,
        paymentsPage,
        paymentsPageSize
      };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const { data } = await apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params });
      if (reqId !== paymentsReqSeq.current || !data.success || !data.overview) {
        return;
      }
      const nextOverview = data.overview;
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              paymentsThisMonth: nextOverview.paymentsThisMonth,
              paymentsThisMonthHasMore: nextOverview.paymentsThisMonthHasMore,
              paymentsThisMonthTotal: nextOverview.paymentsThisMonthTotal,
              paymentsThisMonthPage: nextOverview.paymentsThisMonthPage,
              paymentsThisMonthPageSize: nextOverview.paymentsThisMonthPageSize
            }
          : nextOverview
      );
    } finally {
      if (reqId === paymentsReqSeq.current) {
        setLoadingPaymentsCard(false);
      }
    }
  }, [year, effectiveMonth, selectedBranchId, paymentsPage, paymentsPageSize]);

  const loadPendingPage = useCallback(async () => {
    const reqId = ++pendingReqSeq.current;
    setLoadingPendingCard(true);
    try {
      const params: Record<string, string | number> = {
        year,
        month: effectiveMonth,
        pendingPage,
        pendingPageSize
      };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const { data } = await apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params });
      if (reqId !== pendingReqSeq.current || !data.success || !data.overview) {
        return;
      }
      const nextOverview = data.overview;
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pendingMembers: nextOverview.pendingMembers,
              pendingMembersHasMore: nextOverview.pendingMembersHasMore,
              pendingMembersPage: nextOverview.pendingMembersPage,
              pendingMembersPageSize: nextOverview.pendingMembersPageSize,
              pendingSummary: nextOverview.pendingSummary
            }
          : nextOverview
      );
    } finally {
      if (reqId === pendingReqSeq.current) {
        setLoadingPendingCard(false);
      }
    }
  }, [year, effectiveMonth, selectedBranchId, pendingPage, pendingPageSize]);

  useEffect(() => {
    if (!overviewReady) {
      return;
    }
    void loadPaymentsPage();
  }, [paymentsPage, paymentsPageSize, loadPaymentsPage, overviewReady]);

  useEffect(() => {
    if (!overviewReady) {
      return;
    }
    void loadPendingPage();
  }, [pendingPage, pendingPageSize, loadPendingPage, overviewReady]);

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
        async () => (await apiClient.get<RevenueYearTrendResponse>("/gym/finance/revenue-trend", { params })).data,
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
    void loadRevenueTrend();
  }, [loadRevenueTrend]);

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
        async () => (await apiClient.get<ExpensesYearTrendResponse>("/gym/finance/expenses-trend", { params })).data,
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

  // Lazily load the yearly expenses trend only when the user actually selects "All months".
  // Single-month views remain unchanged and pay no extra round-trip.
  useEffect(() => {
    if (isAllMonths) {
      void loadExpensesTrend();
    }
  }, [isAllMonths, loadExpensesTrend]);

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
  const revenueCardLoading = isAllMonths
    ? loadingRevenueTrend && revenueTrendData.length === 0
    : loadingOverview;
  const expensesCardLoading = isAllMonths
    ? loadingExpensesTrend && expensesTrendData.length === 0
    : loadingOverview;

  const kpiIconWrap = (bg: string, icon: React.ReactNode) => (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        color: "#fff"
      }}
    >
      {icon}
    </div>
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Financial Overview
        </Title>
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
        <Col xs={24} md={8}>
          <Card loading={revenueCardLoading} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#22c55e", <RiseOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Revenue{isAllMonths ? ` · ${periodLabel}` : ""}</Text>
                <Statistic
                  value={displayRevenue}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{
                    fontSize: "clamp(20px, 2.1vw, 28px)",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    wordBreak: "break-word"
                  }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loadingOverview} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#f97316", <ClockCircleOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Overdue amount</Text>
                <Statistic
                  value={overview?.totals.overdue ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{
                    fontSize: "clamp(20px, 2.1vw, 28px)",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    wordBreak: "break-word"
                  }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={expensesCardLoading} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#ef4444", <WalletOutlined />)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text type="secondary">Expenses{isAllMonths ? ` · ${periodLabel}` : ""}</Text>
                <Statistic
                  value={displayExpenses}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{
                    fontSize: "clamp(20px, 2.1vw, 28px)",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    wordBreak: "break-word"
                  }}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        loading={loadingRevenueTrend}
        style={{ marginTop: 16 }}
        styles={{ body: { paddingTop: 16 } }}
        title={
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Monthly Revenue Trends
            </Title>
            <Text type="secondary">Year {year}</Text>
          </div>
        }
      >
        {revenueTrendData.length > 0 ? (
          <RevenueTrendChart chartData={revenueTrendData} gridStroke={token.colorBorderSecondary} />
        ) : (
          <Empty description="No monthly revenue data for this year" />
        )}
      </Card>

      <Card
        loading={loadingOverview}
        style={{ marginTop: 16 }}
        title={
          <div>
            <Title level={5} style={{ margin: 0 }}>
              Revenue by branch
            </Title>
            <Text type="secondary">Performance for {periodLabel || "selected period"}</Text>
          </div>
        }
      >
        {overview && overview.revenueByBranch.length > 0 ? (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            {overview.revenueByBranch.map((b) => (
              <div
                key={b.branchId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: token.colorFillAlter,
                  borderRadius: token.borderRadiusLG
                }}
              >
                <Space>
                  <ArrowUpOutlined style={{ color: token.colorPrimary }} />
                  <Text strong>{b.branchName}</Text>
                </Space>
                <Space size="large" wrap>
                  <Text>
                    {formatInr(b.revenue)} <Text type="secondary">Revenue</Text>
                  </Text>
                  <Text>
                    {formatInr(b.overdue)} <Text type="secondary">Overdue</Text>
                  </Text>
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Empty description="No branch data" />
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            loading={loadingOverview}
            title={
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  Paid This Month
                </Title>
                <Text type="secondary">Members who made payments this month</Text>
              </div>
            }
            extra={
              <ExportButton
                endpoint="/gym/exports/finance/payments"
                params={{
                  year,
                  month,
                  branchId: selectedBranchId || undefined
                }}
                defaultFilename="finance-payments.csv"
              />
            }
          >
            {overview && overview.paymentsThisMonth.length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                loading={loadingPaymentsCard}
                dataSource={overview.paymentsThisMonth}
                columns={[
                  { title: "Member", dataIndex: "memberName", key: "memberName" },
                  {
                    title: "Amount",
                    dataIndex: "amount",
                    key: "amount",
                    align: "right",
                    render: (a: number) => formatInr(a)
                  },
                  {
                    title: "Date",
                    key: "paidAt",
                    render: (_, row) => new Date(row.paidAt).toLocaleString("en-IN", { dateStyle: "medium" })
                  }
                ]}
                pagination={{
                  current: paymentsPage,
                  pageSize: paymentsPageSize,
                  total: overview.paymentsThisMonthTotal ?? overview.paymentsThisMonth.length,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  pageSizeOptions: ["10", "25", "50", "100"],
                  size: "small",
                  onChange: (page, pageSize) => {
                    setPaymentsPage(page);
                    setPaymentsPageSize(pageSize);
                  },
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} payments`
                }}
                scroll={{ x: 560 }}
                tableLayout="fixed"
              />
            ) : (
              <Empty description="No payments this month" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            loading={loadingOverview}
            title={
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  Pending Payments
                </Title>
                <Text type="secondary">Members with outstanding payments</Text>
              </div>
            }
            extra={
              <ExportButton
                endpoint="/gym/exports/finance/pending"
                params={{
                  year,
                  month,
                  branchId: selectedBranchId || undefined
                }}
                defaultFilename="finance-pending.csv"
              />
            }
          >
            {overview && overview.pendingSummary.totalMembers > 0 ? (
              <>
                <div
                  style={{
                    padding: 12,
                    marginBottom: 12,
                    background: token.colorBgContainer,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG
                  }}
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <Text type="secondary">Total members</Text>
                      <div>
                        <Text strong>{overview.pendingSummary.totalMembers}</Text>
                      </div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Total pending</Text>
                      <div>
                        <Text strong>{formatInr(overview.pendingSummary.totalPending)}</Text>
                      </div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Average</Text>
                      <div>
                        <Text strong>{formatInr(overview.pendingSummary.averagePending)}</Text>
                      </div>
                    </Col>
                  </Row>
                </div>
                <Table
                  size="small"
                  rowKey="memberId"
                  loading={loadingPendingCard}
                  dataSource={overview.pendingMembers}
                  columns={[
                    { title: "Member", dataIndex: "name", key: "name" },
                    {
                      title: "Pending",
                      dataIndex: "pendingAmount",
                      key: "pendingAmount",
                      align: "right",
                      render: (a: number) => formatInr(a)
                    },
                    { title: "Plan", dataIndex: "planName", key: "planName", ellipsis: true }
                  ]}
                  pagination={{
                    current: pendingPage,
                    pageSize: pendingPageSize,
                    total: overview.pendingSummary.totalMembers,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ["10", "25", "50", "100"],
                    size: "small",
                    onChange: (page, pageSize) => {
                      setPendingPage(page);
                      setPendingPageSize(pageSize);
                    },
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
                  }}
                  scroll={{ x: 520 }}
                  tableLayout="fixed"
                />
              </>
            ) : (
              <Empty description="No pending payments" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
