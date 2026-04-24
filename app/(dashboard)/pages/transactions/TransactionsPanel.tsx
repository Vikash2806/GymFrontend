"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, DatePicker, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Typography } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { formatInr } from "@/utils/formatCurrency";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type TransactionRow = {
  _id: string;
  memberId: string;
  subscriptionId: string;
  branchId: string;
  amount: number;
  method: "cash" | "upi" | "card";
  status: "success" | "pending" | "failed";
  transactionRef: string | null;
  paidAt: string;
  createdAt: string;
  memberName: string;
  memberPhone: string;
  memberEmail: string | null;
  planName: string;
  membershipStatus: "active" | "expired" | "cancelled" | "paused" | null;
};

type TransactionInsights = {
  totalTransactions: number;
  totalAmount: number;
  successfulCount: number;
  successfulAmount: number;
  successfulMemberCount: number;
  failedCount: number;
  failedAmount: number;
  pendingCount: number;
  pendingAmount: number;
};

type TransactionsResponse = {
  success: boolean;
  transactions?: TransactionRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  insights?: TransactionInsights;
  message?: string;
};

type TransactionFilters = {
  search: string;
  branchId: string;
  status: "all" | "success" | "pending" | "failed";
  method: "all" | "cash" | "upi" | "card";
  dateRange: [Dayjs | null, Dayjs | null] | null;
  minAmount: number | null;
  maxAmount: number | null;
  sortBy: "paidAt" | "createdAt" | "amount";
  sortOrder: "desc" | "asc";
};

const EMPTY_INSIGHTS: TransactionInsights = {
  totalTransactions: 0,
  totalAmount: 0,
  successfulCount: 0,
  successfulAmount: 0,
  successfulMemberCount: 0,
  failedCount: 0,
  failedAmount: 0,
  pendingCount: 0,
  pendingAmount: 0
};

function formatDateTime(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY HH:mm") : "—";
}

export default function TransactionsPanel() {
  const { message } = App.useApp();
  const session = useAppSelector(selectSession);
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [insights, setInsights] = useState<TransactionInsights>(EMPTY_INSIGHTS);

  const initialFilters: TransactionFilters = useMemo(
    () => ({
      search: "",
      branchId: defaultBranchId,
      status: "all",
      method: "all",
      dateRange: null,
      minAmount: null,
      maxAmount: null,
      sortBy: "paidAt",
      sortOrder: "desc"
    }),
    [defaultBranchId]
  );
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
    setDraftFilters(initialFilters);
  }, [initialFilters]);

  const branchOptions = useMemo(
    () => (session?.gym?.branches ?? []).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
    [session?.gym?.branches]
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };
      if (filters.branchId) {
        params.branchId = filters.branchId;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      if (filters.method !== "all") {
        params.method = filters.method;
      }
      if (filters.minAmount !== null && Number.isFinite(filters.minAmount)) {
        params.minAmount = String(filters.minAmount);
      }
      if (filters.maxAmount !== null && Number.isFinite(filters.maxAmount)) {
        params.maxAmount = String(filters.maxAmount);
      }
      if (filters.dateRange?.[0]) {
        params.fromDate = filters.dateRange[0].startOf("day").toISOString();
      }
      if (filters.dateRange?.[1]) {
        params.toDate = filters.dateRange[1].endOf("day").toISOString();
      }

      const { data } = await apiClient.get<TransactionsResponse>("/gym/transactions", { params });
      if (!data.success) {
        message.error(data.message ?? "Could not load transactions.");
        setRows([]);
        setTotal(0);
        setInsights(EMPTY_INSIGHTS);
        return;
      }
      setRows(data.transactions ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setInsights(data.insights ?? EMPTY_INSIGHTS);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load transactions.");
      setRows([]);
      setTotal(0);
      setInsights(EMPTY_INSIGHTS);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, message]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const columns: ColumnsType<TransactionRow> = useMemo(
    () => [
      { title: "Paid At", key: "paidAt", width: 160, render: (_, row) => formatDateTime(row.paidAt) },
      {
        title: "Member",
        key: "member",
        width: 220,
        ellipsis: true,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text strong>{row.memberName || "Unknown member"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              +91{row.memberPhone || "—"}
            </Text>
          </Space>
        )
      },
      { title: "Plan", key: "plan", width: 150, ellipsis: true, render: (_, row) => row.planName || "—" },
      { title: "Method", dataIndex: "method", key: "method", width: 90, render: (value: string) => value.toUpperCase() },
      { title: "Status", dataIndex: "status", key: "status", width: 100, render: (value: string) => value.toUpperCase() },
      { title: "Amount", dataIndex: "amount", key: "amount", width: 130, align: "right", render: (value: number) => formatInr(value) },
      { title: "Reference", dataIndex: "transactionRef", key: "transactionRef", width: 160, ellipsis: true, render: (value: string | null) => value || "—" },
      { title: "Membership", dataIndex: "membershipStatus", key: "membershipStatus", width: 120, render: (value: string | null) => (value ? value.toUpperCase() : "—") }
    ],
    []
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count += 1;
    if (filters.branchId) count += 1;
    if (filters.status !== "all") count += 1;
    if (filters.method !== "all") count += 1;
    if (filters.dateRange?.[0] || filters.dateRange?.[1]) count += 1;
    if (filters.minAmount !== null || filters.maxAmount !== null) count += 1;
    if (filters.sortBy !== "paidAt" || filters.sortOrder !== "desc") count += 1;
    return count;
  }, [filters]);

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Title level={4} style={{ margin: 0 }}>
          Transactions
        </Title>
        <Space>
          <Button type="primary" icon={<FilterOutlined />} onClick={() => setFilterOpen(true)}>
            Filter {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Members Paid (range)" value={insights.successfulMemberCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Collected Amount (range)"
              value={insights.successfulAmount}
              formatter={(value) => formatInr(Number(value))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Pending Amount"
              value={insights.pendingAmount}
              formatter={(value) => formatInr(Number(value))}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Total Transactions" value={insights.totalTransactions} />
          </Card>
        </Col>
      </Row>

      <Table<TransactionRow>
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          showTotal: (value, range) => `${range[0]}-${range[1]} of ${value} transactions`
        }}
        scroll={{ x: 1180 }}
        locale={{ emptyText: "No transactions found for selected filters." }}
      />

      <Modal
        title="Filter Transactions"
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        onOk={() => {
          setFilters(draftFilters);
          setFilterOpen(false);
        }}
        okText="Apply Filters"
        cancelText="Close"
        width={720}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Input
            allowClear
            placeholder="Search member, phone, email, ref"
            value={draftFilters.search}
            onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value.trim() }))}
          />
          <Select
            value={draftFilters.branchId || undefined}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, branchId: value ?? "" }))}
            placeholder="Branch"
            options={branchOptions}
            allowClear
          />
          <Space style={{ width: "100%" }}>
            <Select
              value={draftFilters.status}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "all", label: "All status" },
                { value: "success", label: "Success" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" }
              ]}
              style={{ flex: 1 }}
            />
            <Select
              value={draftFilters.method}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, method: value }))}
              options={[
                { value: "all", label: "All methods" },
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI" },
                { value: "card", label: "Card" }
              ]}
              style={{ flex: 1 }}
            />
          </Space>
          <RangePicker
            value={draftFilters.dateRange}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
            format="DD-MM-YYYY"
            style={{ width: "100%" }}
          />
          <Space style={{ width: "100%" }}>
            <InputNumber
              min={0}
              step={100}
              value={draftFilters.minAmount}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, minAmount: typeof value === "number" ? value : null }))}
              placeholder="Min amount"
              style={{ width: "100%" }}
            />
            <InputNumber
              min={0}
              step={100}
              value={draftFilters.maxAmount}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, maxAmount: typeof value === "number" ? value : null }))}
              placeholder="Max amount"
              style={{ width: "100%" }}
            />
          </Space>
          <Space style={{ width: "100%" }}>
            <Select
              value={draftFilters.sortBy}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, sortBy: value }))}
              options={[
                { value: "paidAt", label: "Sort by Paid At" },
                { value: "createdAt", label: "Sort by Created At" },
                { value: "amount", label: "Sort by Amount" }
              ]}
              style={{ flex: 1 }}
            />
            <Select
              value={draftFilters.sortOrder}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, sortOrder: value }))}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" }
              ]}
              style={{ flex: 1 }}
            />
          </Space>
          <Button
            onClick={() => setDraftFilters(initialFilters)}
            style={{ width: "100%" }}
          >
            Reset Filters
          </Button>
        </Space>
      </Modal>
    </Space>
  );
}

