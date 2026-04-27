"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Descriptions, Divider, Modal, Pagination, Space, Table, Tabs, Tag, Typography, theme } from "antd";
import dayjs from "dayjs";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import { formatInrWhole } from "@/utils/formatCurrency";
import type { Member } from "@/types/member";
import apiClient from "@/utils/api";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;

type SubscriptionHistoryItem = {
  _id: string;
  planName: string;
  status: "active" | "expired" | "cancelled" | "paused";
  startDate: string;
  endDate: string;
  paymentSummary: { totalAmount: number; paidAmount: number; pendingAmount: number; status: string };
  createdAt: string;
};

type MemberDetailsModalProps = {
  open: boolean;
  member: Member | null;
  onClose: () => void;
};

type SubscriptionHistoryResponse = {
  success: boolean;
  subscriptions?: SubscriptionHistoryItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

type MemberPaymentItem = {
  _id: string;
  planName?: string;
  amount: number;
  method: "cash" | "upi" | "card";
  status: "success" | "pending" | "failed" | "refunded";
  createdAt: string;
};

type MemberPaymentsResponse = {
  success: boolean;
  payments?: MemberPaymentItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

function formatDisplayDate(iso: string | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY") : "—";
}

function ageFromDob(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : "—";
}

export default function MemberDetailsModal({ open, member, onClose }: MemberDetailsModalProps) {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<"details" | "history" | "transactions">("details");
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [membershipHistory, setMembershipHistory] = useState<SubscriptionHistoryItem[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const paymentsPageSize = 5;
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [payments, setPayments] = useState<MemberPaymentItem[]>([]);
  const paymentColumns: ColumnsType<MemberPaymentItem> = useMemo(
    () => [
      {
        title: "Subscription",
        key: "planName",
        dataIndex: "planName",
        render: (value: string | undefined) => value ?? "Unknown plan"
      },
      {
        title: "Payment Date",
        key: "createdAt",
        dataIndex: "createdAt",
        render: (value: string) => formatDisplayDate(value)
      },
      {
        title: "Method",
        key: "method",
        dataIndex: "method",
        render: (value: string) => value.toUpperCase()
      },
      {
        title: "Amount",
        key: "amount",
        dataIndex: "amount",
        align: "right",
        render: (value: number, row) => (
          <Text style={{ color: row.status === "refunded" ? token.colorError : row.status === "success" ? token.colorSuccess : undefined }}>
            {formatInrWhole(value)}
          </Text>
        )
      },
      {
        title: "Status",
        key: "status",
        dataIndex: "status",
        render: (value: MemberPaymentItem["status"]) => (
          <Tag color={value === "refunded" ? "error" : value === "success" ? "success" : value === "pending" ? "warning" : "default"}>
            {value.toUpperCase()}
          </Tag>
        )
      }
    ],
    [token.colorError, token.colorSuccess]
  );
  const historyColumns: ColumnsType<SubscriptionHistoryItem> = useMemo(
    () => [
      {
        title: "Plan",
        key: "planName",
        dataIndex: "planName",
        render: (value: string) => value || "—"
      },
      {
        title: "Start Date",
        key: "startDate",
        dataIndex: "startDate",
        render: (value: string) => formatDisplayDate(value)
      },
      {
        title: "End Date",
        key: "endDate",
        dataIndex: "endDate",
        render: (value: string) => formatDisplayDate(value)
      },
      {
        title: "Paid",
        key: "paidAmount",
        align: "right",
        render: (_, row) => formatInrWhole(row.paymentSummary?.paidAmount ?? 0)
      },
      {
        title: "Pending",
        key: "pendingAmount",
        align: "right",
        render: (_, row) => formatInrWhole(row.paymentSummary?.pendingAmount ?? 0)
      },
      {
        title: "Status",
        key: "status",
        dataIndex: "status",
        render: (value: SubscriptionHistoryItem["status"]) => (
          <Tag
            color={
              value === "active" ? "success" : value === "cancelled" ? "error" : value === "expired" ? "orange" : "default"
            }
          >
            {value.toUpperCase()}
          </Tag>
        )
      }
    ],
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveTab("details");
    setHistoryPage(1);
    setPaymentsPage(1);
  }, [open, member?._id]);
  useEffect(() => {
    if (!open || !member || activeTab !== "history") {
      return;
    }
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await apiClient.get<SubscriptionHistoryResponse>(
          `/gym/members/${member._id}/subscriptions`,
          { params: { page: historyPage, pageSize: historyPageSize } }
        );
        if (cancelled) {
          return;
        }
        if (data.success) {
          setMembershipHistory(data.subscriptions ?? []);
          setHistoryTotal(typeof data.total === "number" ? data.total : data.subscriptions?.length ?? 0);
        } else {
          setMembershipHistory([]);
          setHistoryTotal(0);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setMembershipHistory([]);
        setHistoryTotal(0);
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [open, member?._id, activeTab, historyPage]);

  useEffect(() => {
    if (!open || !member || activeTab !== "transactions") {
      return;
    }
    let cancelled = false;
    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        const { data } = await apiClient.get<MemberPaymentsResponse>(
          `/gym/members/${member._id}/payments`,
          { params: { page: paymentsPage, pageSize: paymentsPageSize } }
        );
        if (cancelled) {
          return;
        }
        if (data.success) {
          setPayments(data.payments ?? []);
          setPaymentsTotal(typeof data.total === "number" ? data.total : data.payments?.length ?? 0);
        } else {
          setPayments([]);
          setPaymentsTotal(0);
        }
      } catch {
        if (cancelled) {
          return;
        }
        setPayments([]);
        setPaymentsTotal(0);
      } finally {
        if (!cancelled) {
          setPaymentsLoading(false);
        }
      }
    };
    void loadPayments();
    return () => {
      cancelled = true;
    };
  }, [open, member?._id, activeTab, paymentsPage]);

  return (
    <Modal
      title="Member Details"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>
      ]}
      width={WIDE_MODAL_WIDTH}
    >
      {member ? (
        <>
          <Space align="start" size={16} style={{ marginBottom: 16 }}>
            <Avatar size={64} src={member.profile.profilePicture || undefined}>
              {!member.profile.profilePicture ? `${member.firstName.charAt(0)}${member.lastName.charAt(0)}` : null}
            </Avatar>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                {member.firstName} {member.lastName}
              </Title>
              <Space size={8} style={{ marginTop: 8 }}>
                <Tag color={member.status === "active" ? "success" : "error"}>
                  {member.status === "active" ? "ACTIVE" : "INACTIVE"}
                </Tag>
                {member.flags?.hasPendingPayment ? <Tag color="warning">PAYMENT PENDING</Tag> : null}
              </Space>
            </div>
          </Space>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab((key as "details" | "history" | "transactions") ?? "details")}
            items={[
              {
                key: "details",
                label: "Details",
                children: (
                  <>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="Phone">+91{member.profile.phone}</Descriptions.Item>
                      <Descriptions.Item label="Date of Birth">
                        {member.profile.dob ? formatDisplayDate(member.profile.dob) : "N/A"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Age">{ageFromDob(member.profile.dob)}</Descriptions.Item>
                    </Descriptions>
                    <Divider orientationMargin={8} />
                    <Text strong>Membership</Text>
                    <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
                      <Descriptions.Item label="Lifetime Total Paid (₹)">
                        {formatInrWhole(member.financialSummary?.lifetime?.totalPaid ?? 0)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Membership Type">{member.currentSubscription?.planName ?? "—"}</Descriptions.Item>
                      <Descriptions.Item label="Total Amount (₹)">
                        {member.currentSubscription ? formatInrWhole(member.currentSubscription.payment.totalAmount) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Start Date">
                        {member.currentSubscription ? formatDisplayDate(member.currentSubscription.startDate) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="End Date">
                        {member.currentSubscription ? formatDisplayDate(member.currentSubscription.endDate) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Paid Amount (₹)">
                        {member.currentSubscription ? formatInrWhole(member.currentSubscription.payment.paidAmount) : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Outstanding Amount (₹)">
                        <Text type="danger">
                          {member.currentSubscription ? formatInrWhole(member.currentSubscription.payment.pendingAmount) : "—"}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                    <Divider orientationMargin={8} />
                    <Text strong>Personal details</Text>
                    <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
                      <Descriptions.Item label="Gender">{member.profile.gender}</Descriptions.Item>
                      <Descriptions.Item label="Address">
                        {[member.address.street, member.address.city, member.address.state, member.address.zipcode]
                          .filter(Boolean)
                          .join(", ") || "N/A"}
                      </Descriptions.Item>
                    </Descriptions>
                  </>
                )
              },
              {
                key: "history",
                label: "Membership History",
                children: (
                  <div style={{ marginTop: 4 }}>
                    {historyLoading ? (
                      <Text type="secondary">Loading history…</Text>
                    ) : membershipHistory.length === 0 ? (
                      <Text type="secondary">No membership history found.</Text>
                    ) : (
                      <>
                        <Table<SubscriptionHistoryItem>
                          rowKey="_id"
                          size="small"
                          columns={historyColumns}
                          dataSource={membershipHistory}
                          pagination={false}
                          scroll={{ x: 760 }}
                        />
                        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                          <Pagination
                            size="small"
                            current={historyPage}
                            pageSize={historyPageSize}
                            total={historyTotal}
                            onChange={(nextPage) => setHistoryPage(nextPage)}
                            showSizeChanger={false}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
              },
              {
                key: "transactions",
                label: "Transactions",
                children: (
                  <div style={{ marginTop: 4 }}>
                    {paymentsLoading ? (
                      <Text type="secondary">Loading transactions…</Text>
                    ) : payments.length === 0 ? (
                      <Text type="secondary">No transactions found.</Text>
                    ) : (
                      <>
                        <Table<MemberPaymentItem>
                          rowKey="_id"
                          size="small"
                          columns={paymentColumns}
                          dataSource={payments}
                          pagination={false}
                          scroll={{ x: 700 }}
                        />
                        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                          <Pagination
                            size="small"
                            current={paymentsPage}
                            pageSize={paymentsPageSize}
                            total={paymentsTotal}
                            onChange={(nextPage) => setPaymentsPage(nextPage)}
                            showSizeChanger={false}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
              }
            ]}
          />
        </>
      ) : (
        <div style={{ padding: 24, textAlign: "center" }}>
          <Text type="secondary">Loading…</Text>
        </div>
      )}
    </Modal>
  );
}
