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
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  const selectedBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const overviewReqSeq = useRef(0);
  const paymentsReqSeq = useRef(0);
  const pendingReqSeq = useRef(0);
  const revenueTrendReqSeq = useRef(0);

  const loadOverview = useCallback(async () => {
    const reqId = ++overviewReqSeq.current;
    setLoadingOverview(true);
    try {
      const params: Record<string, string | number> = { year, month };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const { data } = await apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params });
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
  }, [year, month, selectedBranchId, message]);

  useEffect(() => {
    setPaymentsPage(1);
    setPendingPage(1);
  }, [year, month, selectedBranchId]);

  useEffect(() => {
    void loadOverview();
  }, [year, month, selectedBranchId, loadOverview]);

  const loadPaymentsPage = useCallback(async () => {
    const reqId = ++paymentsReqSeq.current;
    setLoadingPaymentsCard(true);
    try {
      const params: Record<string, string | number> = {
        year,
        month,
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
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              paymentsThisMonth: data.overview.paymentsThisMonth,
              paymentsThisMonthHasMore: data.overview.paymentsThisMonthHasMore,
              paymentsThisMonthTotal: data.overview.paymentsThisMonthTotal,
              paymentsThisMonthPage: data.overview.paymentsThisMonthPage,
              paymentsThisMonthPageSize: data.overview.paymentsThisMonthPageSize
            }
          : data.overview
      );
    } finally {
      if (reqId === paymentsReqSeq.current) {
        setLoadingPaymentsCard(false);
      }
    }
  }, [year, month, selectedBranchId, paymentsPage, paymentsPageSize]);

  const loadPendingPage = useCallback(async () => {
    const reqId = ++pendingReqSeq.current;
    setLoadingPendingCard(true);
    try {
      const params: Record<string, string | number> = {
        year,
        month,
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
      setOverview((prev) =>
        prev
          ? {
              ...prev,
              pendingMembers: data.overview.pendingMembers,
              pendingMembersHasMore: data.overview.pendingMembersHasMore,
              pendingMembersPage: data.overview.pendingMembersPage,
              pendingMembersPageSize: data.overview.pendingMembersPageSize,
              pendingSummary: data.overview.pendingSummary
            }
          : data.overview
      );
    } finally {
      if (reqId === pendingReqSeq.current) {
        setLoadingPendingCard(false);
      }
    }
  }, [year, month, selectedBranchId, pendingPage, pendingPageSize]);

  useEffect(() => {
    if (!overview) {
      return;
    }
    void loadPaymentsPage();
  }, [paymentsPage, paymentsPageSize, loadPaymentsPage]);

  useEffect(() => {
    if (!overview) {
      return;
    }
    void loadPendingPage();
  }, [pendingPage, pendingPageSize, loadPendingPage]);

  const loadRevenueTrend = useCallback(async () => {
    const reqId = ++revenueTrendReqSeq.current;
    setLoadingRevenueTrend(true);
    try {
      const requests = Array.from({ length: 12 }, (_, i) => {
        const monthValue = i + 1;
        const params: Record<string, string | number> = { year, month: monthValue };
        if (selectedBranchId) {
          params.branchId = selectedBranchId;
        }
        return apiClient.get<FinanceOverviewResponse>("/gym/finance/overview", { params });
      });

      const results = await Promise.all(requests);
      if (reqId !== revenueTrendReqSeq.current) {
        return;
      }
      const nextData = results.map((result, index) => ({
        month: index + 1,
        label: MONTH_SHORT[index],
        amount: result.data.success && result.data.overview ? result.data.overview.totals.revenue : 0,
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

  const periodLabel = useMemo(() => {
    if (!overview) {
      return "";
    }
    const m = MONTHS.find((x) => x.value === overview.period.month)?.label ?? "";
    return `${m} ${overview.period.year}`;
  }, [overview]);

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
            style={{ width: 140 }}
            value={month}
            onChange={setMonth}
            options={MONTHS.map((m) => ({ value: m.value, label: m.label }))}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card loading={loadingOverview} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#22c55e", <RiseOutlined />)}
              <div style={{ flex: 1 }}>
                <Text type="secondary">Revenue</Text>
                <Statistic
                  value={overview?.totals.revenue ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 22, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loadingOverview} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#f97316", <ClockCircleOutlined />)}
              <div style={{ flex: 1 }}>
                <Text type="secondary">Overdue amount</Text>
                <Statistic
                  value={overview?.totals.overdue ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 22, fontWeight: 600 }}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={loadingOverview} styles={{ body: { padding: 20 } }}>
            <Space align="start" size="middle" style={{ width: "100%" }}>
              {kpiIconWrap("#ef4444", <WalletOutlined />)}
              <div style={{ flex: 1 }}>
                <Text type="secondary">Expenses</Text>
                <Statistic
                  value={overview?.totals.expenses ?? 0}
                  formatter={(v) => formatInr(Number(v))}
                  valueStyle={{ fontSize: 22, fontWeight: 600 }}
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
