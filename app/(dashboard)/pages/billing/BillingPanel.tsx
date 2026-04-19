"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import apiClient from "@/utils/api";
import { formatInr } from "@/utils/formatCurrency";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { Member } from "@/types/member";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";

const { Title, Text } = Typography;

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<Member>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

type ListResponse = { success: boolean; members?: Member[]; message?: string };

type PostPaymentResponse = {
  success: boolean;
  message?: string;
  member?: Member;
};

type PaymentFormValues = {
  amount: number;
  method: "cash" | "upi" | "card";
  transactionRef?: string;
  paidAt: Dayjs;
};

export default function BillingPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>(defaultBranchId);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingMember, setPayingMember] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PaymentFormValues>();

  useEffect(() => {
    if (defaultBranchId && !branchFilter) {
      setBranchFilter(defaultBranchId);
    }
  }, [defaultBranchId, branchFilter]);

  const branchCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of session?.gym?.branches ?? []) {
      map.set(b.id, b.code);
    }
    return map;
  }, [session?.gym?.branches]);

  const branchOptions = useMemo(() => {
    const br = session?.gym?.branches ?? [];
    return br.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  }, [session?.gym]);

  const loadMembers = useCallback(async () => {
    if (!branchFilter) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        branchId: branchFilter,
        pendingPayment: "true"
      };
      const q = search.trim();
      if (q) {
        params.search = q;
      }
      const { data } = await apiClient.get<ListResponse>("/gym/members", { params });
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
      } else {
        setMembers([]);
        if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load overdue payments.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, search, message]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const openPay = useCallback(
    (record: Member) => {
      const sub = record.currentSubscription;
      if (!sub) {
        message.warning("No active subscription on file for this member.");
        return;
      }
      setPayingMember(record);
      form.setFieldsValue({
        amount: sub.payment.pendingAmount,
        method: "cash",
        transactionRef: undefined,
        paidAt: dayjs()
      });
      setPayModalOpen(true);
    },
    [form, message]
  );

  const closePay = () => {
    setPayModalOpen(false);
    setPayingMember(null);
    form.resetFields();
  };

  const submitPayment = async () => {
    if (!payingMember?.currentSubscription) {
      return;
    }
    const values = await form.validateFields();
    const subId = payingMember.currentSubscription.subscriptionId;
    const pending = payingMember.currentSubscription.payment.pendingAmount;
    if (values.amount > pending + 0.0001) {
      message.error(`Amount cannot exceed outstanding balance (${formatInr(pending)}).`);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await apiClient.post<PostPaymentResponse>(
        `/gym/members/${payingMember._id}/subscriptions/${subId}/payments`,
        {
          amount: values.amount,
          method: values.method,
          status: "success",
          transactionRef: values.transactionRef?.trim() || null,
          paidAt: values.paidAt.toISOString()
        }
      );
      if (!data.success) {
        message.error(data.message ?? "Payment failed.");
        return;
      }
      message.success("Payment recorded.");
      closePay();
      await loadMembers();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Payment failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<Member> = useMemo(
    () => [
      {
        title: "Member",
        key: "member",
        ellipsis: true,
        render: (_, record) => {
          const code = branchCodeById.get(record.branchId);
          return (
            <Space direction="vertical" size={0}>
              <Text strong>
                {record._id.slice(-6)}_{record.firstName} {record.lastName}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {(code ?? record.branchId).toLowerCase()}
              </Text>
            </Space>
          );
        }
      },
      {
        title: "Membership",
        key: "membership",
        width: 160,
        ellipsis: true,
        render: (_, record) => record.currentSubscription?.planName ?? "—"
      },
      {
        title: "Total Amount",
        key: "total",
        width: 140,
        align: "right" as const,
        render: (_, record) =>
          record.currentSubscription ? formatInr(record.currentSubscription.payment.totalAmount) : "—"
      },
      {
        title: "Paid Amount",
        key: "paid",
        width: 140,
        align: "right" as const,
        render: (_, record) =>
          record.currentSubscription ? formatInr(record.currentSubscription.payment.paidAmount) : "—"
      },
      {
        title: "Overdue Amount",
        key: "overdue",
        width: 150,
        align: "right" as const,
        render: (_, record) =>
          record.currentSubscription ? (
            <Text style={{ color: token.colorWarning }}>{formatInr(record.currentSubscription.payment.pendingAmount)}</Text>
          ) : (
            "—"
          )
      },
      {
        title: "Actions",
        key: "actions",
        width: 160,
        fixed: "right" as const,
        render: (_, record) => (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPay(record)}>
            Add Payment
          </Button>
        )
      }
    ],
    [branchCodeById, openPay, token.colorWarning]
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Overdue Payments
        </Title>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="Search name, phone…"
            style={{ minWidth: 220 }}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={(v) => setSearch(v)}
            onClear={() => {
              setSearchDraft("");
              setSearch("");
            }}
            enterButton
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220 }}
            placeholder="Branch"
            value={branchFilter || undefined}
            onChange={(v) => setBranchFilter(v)}
            options={branchOptions}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadMembers()}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table<Member>
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={members}
        components={tableComponents}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} pending payments`
        }}
        scroll={{ x: 960 }}
        locale={{ emptyText: "No overdue payments" }}
      />

      <Modal
        title="Record payment"
        open={payModalOpen}
        onCancel={closePay}
        okText="Submit payment"
        okButtonProps={{ type: "primary", loading: submitting }}
        onOk={() => void submitPayment()}
        destroyOnClose
        width={WIDE_MODAL_WIDTH}
      >
        {payingMember?.currentSubscription ? (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              {payingMember.firstName} {payingMember.lastName} · Outstanding{" "}
              <Text strong style={{ color: token.colorWarning }}>
                {formatInr(payingMember.currentSubscription.payment.pendingAmount)}
              </Text>
            </Text>
          </div>
        ) : null}
        <Form<PaymentFormValues> form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="amount"
            label="Amount (₹)"
            rules={[
              { required: true, message: "Enter amount" },
              {
                validator: (_, v) => {
                  if (v === undefined || v === null) {
                    return Promise.reject(new Error("Enter amount"));
                  }
                  const pending = payingMember?.currentSubscription?.payment.pendingAmount ?? 0;
                  if (v <= 0) {
                    return Promise.reject(new Error("Amount must be greater than zero"));
                  }
                  if (v > pending + 0.0001) {
                    return Promise.reject(new Error(`Cannot exceed ${formatInr(pending)}`));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} precision={2} />
          </Form.Item>
          <Form.Item name="method" label="Method" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI" },
                { value: "card", label: "Card" }
              ]}
            />
          </Form.Item>
          <Form.Item name="transactionRef" label="Transaction reference (optional)">
            <Input maxLength={256} placeholder="UPI ref / receipt no." />
          </Form.Item>
          <Form.Item name="paidAt" label="Paid at" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} format="DD-MM-YYYY HH:mm" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
