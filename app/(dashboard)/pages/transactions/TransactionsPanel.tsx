"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Row, Space, Statistic, Table, Typography } from "antd";
import { FilterOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { formatInr } from "@/utils/formatCurrency";
import TransactionsFilterModal, { type TransactionFilters } from "./TransactionsFilterModal";

const { Title, Text } = Typography;

type TransactionRow = {
  _id: string;
  memberId: string;
  subscriptionId: string;
  branchId: string;
  amount: number;
  method: "cash" | "upi" | "card";
  status: "success" | "pending" | "failed" | "refunded";
  transactionRef: string | null;
  paidAt: string;
  createdAt: string;
  memberName: string;
  memberPhone: string;
  memberEmail: string | null;
  planName: string;
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
  refundedCount: number;
  refundedAmount: number;
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

const EMPTY_INSIGHTS: TransactionInsights = {
  totalTransactions: 0,
  totalAmount: 0,
  successfulCount: 0,
  successfulAmount: 0,
  successfulMemberCount: 0,
  failedCount: 0,
  failedAmount: 0,
  pendingCount: 0,
  pendingAmount: 0,
  refundedCount: 0,
  refundedAmount: 0
};

function formatDateTime(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY HH:mm") : "—";
}

export default function TransactionsPanel() {
  const STORAGE_KEY = "transactionFilters";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);

  const branchOptions = useMemo(
    () => (session?.gym?.branches ?? []).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
    [session?.gym?.branches]
  );

  const countActiveFilters = useCallback((value: TransactionFilters) => {
    let count = 0;
    if (value.search) count += 1;
    if (value.branchId) count += 1;
    if (value.status !== "all") count += 1;
    if (value.method !== "all") count += 1;
    if (value.dateRange?.[0] || value.dateRange?.[1]) count += 1;
    if (value.minAmount !== null || value.maxAmount !== null) count += 1;
    if (value.sortBy !== "paidAt" || value.sortOrder !== "desc") count += 1;
    return count;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedFiltersRaw = window.localStorage.getItem(STORAGE_KEY);
    if (!savedFiltersRaw) {
      setFilters(initialFilters);
      setActiveFilters(countActiveFilters(initialFilters));
      return;
    }
    try {
      const saved = JSON.parse(savedFiltersRaw) as Omit<TransactionFilters, "dateRange"> & {
        fromDate?: string;
        toDate?: string;
      };
      const restored: TransactionFilters = {
        ...initialFilters,
        ...saved,
        dateRange:
          saved.fromDate && saved.toDate ? [dayjs(saved.fromDate), dayjs(saved.toDate)] : null
      };
      setFilters(restored);
      setActiveFilters(countActiveFilters(restored));
    } catch {
      setFilters(initialFilters);
      setActiveFilters(countActiveFilters(initialFilters));
    }
  }, [initialFilters, countActiveFilters]);

  useEffect(() => {
    setPage(1);
    setActiveFilters(countActiveFilters(filters));
  }, [filters, countActiveFilters]);

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
    ],
    []
  );

  const applyFilters = (nextFilters: TransactionFilters) => {
    setFilters(nextFilters);
    if (typeof window !== "undefined") {
      const payload = {
        ...nextFilters,
        fromDate: nextFilters.dateRange?.[0]?.toISOString() ?? "",
        toDate: nextFilters.dateRange?.[1]?.toISOString() ?? ""
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setFilterOpen(false);
  };

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Title level={4} style={{ margin: 0 }}>
          Transactions
        </Title>
        <Space>
          <Button icon={<FilterOutlined />} onClick={() => setFilterOpen(true)}>
            Filters
            {activeFilters > 0 ? (
              <span
                style={{
                  marginLeft: 8,
                  backgroundColor: "#1677ff",
                  color: "#fff",
                  borderRadius: "50%",
                  padding: "2px 6px",
                  fontSize: "12px",
                  minWidth: "16px",
                  display: "inline-block",
                  textAlign: "center"
                }}
              >
                {activeFilters}
              </span>
            ) : null}
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
              title="Refunded Amount (range)"
              value={insights.refundedAmount}
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
          showQuickJumper: true,
          pageSizeOptions: ["10", "25", "50", "100"],
          size: "small",
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
          showTotal: (value, range) => `${range[0]}-${range[1]} of ${value} transactions`
        }}
        scroll={{ x: 1180 }}
        locale={{ emptyText: "No transactions found for selected filters." }}
      />

      <TransactionsFilterModal
        open={filterOpen}
        branchOptions={branchOptions}
        currentFilters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </Space>
  );
}

