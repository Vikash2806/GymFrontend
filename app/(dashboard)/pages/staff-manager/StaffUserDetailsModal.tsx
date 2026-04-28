"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Descriptions, Divider, Modal, Pagination, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import { formatInrWhole } from "@/utils/formatCurrency";
import type { StaffUserDetailsResponse, StaffUserExpenseTransaction, StaffUserRow } from "@/types/staffUser";

const { Text } = Typography;

type Props = {
  open: boolean;
  userId: string | null;
  onClose: () => void;
};

export default function StaffUserDetailsModal({ open, userId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"details" | "transactions">("details");
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [user, setUser] = useState<StaffUserRow | null>(null);
  const [rows, setRows] = useState<StaffUserExpenseTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);

  const columns = useMemo<ColumnsType<StaffUserExpenseTransaction>>(
    () => [
      {
        title: "Date",
        dataIndex: "date",
        key: "date",
        render: (value: string) => dayjs(value).format("DD-MM-YYYY")
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        align: "right",
        render: (value: number) => formatInrWhole(value)
      },
      {
        title: "Notes",
        dataIndex: "notes",
        key: "notes",
        render: (value: string) => value || "—"
      }
    ],
    []
  );

  useEffect(() => {
    if (!open || !userId) {
      return;
    }
    let cancelled = false;
    const loadUserDetails = async () => {
      setDetailsLoading(true);
      try {
        const { data } = await apiClient.get<StaffUserDetailsResponse>(`/gym/staff-users/${userId}/details`, {
          params: { includeTransactions: false }
        });
        if (cancelled) {
          return;
        }
        if (data.success) {
          setUser(data.user ?? null);
        } else {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    };
    void loadUserDetails();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open || !userId || activeTab !== "transactions") {
      return;
    }
    let cancelled = false;
    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const { data } = await apiClient.get<StaffUserDetailsResponse>(`/gym/staff-users/${userId}/details`, {
          params: { page, pageSize, includeTransactions: true }
        });
        if (cancelled) {
          return;
        }
        if (data.success) {
          setRows(data.transactions ?? []);
          setTotal(data.total ?? 0);
          setTransactionsLoaded(true);
        } else {
          setRows([]);
          setTotal(0);
          setTransactionsLoaded(true);
        }
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      }
    };
    void loadTransactions();
    return () => {
      cancelled = true;
    };
  }, [open, userId, activeTab, page, pageSize]);

  useEffect(() => {
    if (open) {
      setActiveTab("details");
      setPage(1);
      setRows([]);
      setTotal(0);
      setTransactionsLoaded(false);
    }
  }, [open, userId]);

  return (
    <Modal
      title="Staff/Manager Details"
      open={open}
      onCancel={onClose}
      width={WIDE_MODAL_WIDTH}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as "details" | "transactions")}
        items={[
          {
            key: "details",
            label: "Details",
            children: user ? (
              <>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Name">{user.fullName}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{user.phone}</Descriptions.Item>
                  <Descriptions.Item label="Role">
                    <Tag color={user.role === "manager" ? "blue" : "default"}>
                      {user.role === "manager" ? "Manager" : "Staff"}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={user.status === "active" ? "green" : "default"}>
                      {user.status === "active" ? "Active" : "Inactive"}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Lifetime Salary">
                    {formatInrWhole(user.salarySummary?.lifetimeTotal ?? 0)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Current Month Salary">
                    {formatInrWhole(user.salarySummary?.currentMonthTotal ?? 0)}
                  </Descriptions.Item>
                </Descriptions>
                <Divider style={{ margin: "12px 0" }} />
                <Text strong style={{ display: "block", marginBottom: 8 }}>
                  Personal details
                </Text>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Address">{user.address?.trim() ? user.address : "—"}</Descriptions.Item>
                  <Descriptions.Item label="Aadhaar Number">
                    {user.aadhaarNumber?.trim() ? user.aadhaarNumber : "—"}
                  </Descriptions.Item>
                </Descriptions>
              </>
            ) : (
              <Text type="secondary">{detailsLoading ? "Loading details..." : "No details available."}</Text>
            )
          },
          {
            key: "transactions",
            label: "Transactions",
            children: (
              <>
                <Table<StaffUserExpenseTransaction>
                  rowKey="id"
                  size="small"
                  loading={transactionsLoading}
                  columns={columns}
                  dataSource={rows}
                  pagination={false}
                  locale={{
                    emptyText:
                      !transactionsLoaded && !transactionsLoading
                        ? "Open this tab to load transactions."
                        : "No transactions found."
                  }}
                  scroll={{ x: 620 }}
                  tableLayout="fixed"
                />
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <Pagination
                    size="small"
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    onChange={(nextPage) => setPage(nextPage)}
                    showSizeChanger={false}
                    disabled={!transactionsLoaded && !transactionsLoading}
                  />
                </div>
              </>
            )
          }
        ]}
      />
    </Modal>
  );
}
