"use client";

import React, { useEffect } from "react";
import { App, DatePicker, Form, Input, InputNumber, Modal, Select, Typography, theme } from "antd";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { formatInr } from "@/utils/formatCurrency";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";

const { Text } = Typography;

export type OverduePaymentFormValues = {
  amount: number;
  method: "cash" | "upi" | "card";
  transactionRef?: string;
};

type PostSubscriptionPaymentResponse = {
  success: boolean;
  message?: string;
  member?: unknown;
};

type PostMemberOverdueResponse = {
  success: boolean;
  message?: string;
  member?: unknown;
};

export type OverduePaymentModalProps = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberDisplayName: string;
  totalPending: number;
  /** When set, payment is applied to this subscription only (legacy billing row). When omitted, FIFO overdue settlement across memberships. */
  subscriptionId?: string | null;
  onSuccess?: () => void | Promise<void>;
};

export default function OverduePaymentModal({
  open,
  onClose,
  memberId,
  memberDisplayName,
  totalPending,
  subscriptionId,
  onSuccess
}: OverduePaymentModalProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm<OverduePaymentFormValues>();
  const [submitting, setSubmitting] = React.useState(false);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }
    form.setFieldsValue({
      amount: totalPending,
      method: "cash",
      transactionRef: undefined
    });
  }, [open, totalPending, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const pending = totalPending;
    if (values.amount > pending + 0.0001) {
      message.error(`Amount cannot exceed outstanding balance (${formatInr(pending)}).`);
      return;
    }
    setSubmitting(true);
    try {
      if (subscriptionId) {
        const { data } = await apiClient.post<PostSubscriptionPaymentResponse>(
          `/gym/members/${memberId}/subscriptions/${subscriptionId}/payments`,
          {
            amount: values.amount,
            method: values.method,
            status: "success",
            transactionRef: values.transactionRef?.trim() || null,
            paidAt: dayjs().toISOString()
          }
        );
        if (!data.success) {
          message.error(data.message ?? "Payment failed.");
          return;
        }
      } else {
        const { data } = await apiClient.post<PostMemberOverdueResponse>(`/gym/members/${memberId}/overdue-payments`, {
          amount: values.amount,
          method: values.method,
          transactionRef: values.transactionRef?.trim() || null,
          paidAt: dayjs().toISOString()
        });
        if (!data.success) {
          message.error(data.message ?? "Payment failed.");
          return;
        }
      }
      message.success("Payment recorded.");
      onClose();
      await onSuccess?.();
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

  return (
    <Modal
      title="Record payment"
      open={open}
      onCancel={onClose}
      okText="Submit payment"
      okButtonProps={{ type: "primary", loading: submitting }}
      onOk={() => void handleSubmit()}
      destroyOnHidden
      width={WIDE_MODAL_WIDTH}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {memberDisplayName} · Outstanding{" "}
          <Text strong style={{ color: token.colorWarning }}>
            {formatInr(totalPending)}
          </Text>
        </Text>
      </div>
      <Form<OverduePaymentFormValues> form={form} layout="vertical" requiredMark={false}>
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
                if (v <= 0) {
                  return Promise.reject(new Error("Amount must be greater than zero"));
                }
                if (v > totalPending + 0.0001) {
                  return Promise.reject(new Error(`Cannot exceed ${formatInr(totalPending)}`));
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
        <Form.Item label="Paid at">
          <DatePicker showTime disabled value={dayjs()} inputReadOnly style={{ width: "100%" }} format="DD-MM-YYYY HH:mm" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
