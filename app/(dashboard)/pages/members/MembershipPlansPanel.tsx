"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { EditOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { MembershipPlan, MembershipPlanInput } from "@/types/membership";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";

const { TextArea } = Input;
const { Title } = Typography;

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<MembershipPlan>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

type ListResponse = { success: boolean; plans?: MembershipPlan[]; message?: string };
type PlanResponse = { success: boolean; plan?: MembershipPlan; message?: string };

export default function MembershipPlansPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const branchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MembershipPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<MembershipPlanInput>();

  const loadPlans = useCallback(async () => {
    if (!branchId) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get<ListResponse>("/gym/membership-plans", {
        params: { branchId }
      });
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans);
      } else {
        setPlans([]);
        if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load membership plans.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, message]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const openCreate = () => {
    if (!branchId) {
      message.warning("Select a branch in the header first.");
      return;
    }
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      branchId,
      name: "",
      type: "",
      duration: undefined,
      price: undefined,
      description: "",
      isActive: true
    });
    setModalOpen(true);
  };

  const openEdit = (record: MembershipPlan) => {
    setEditing(record);
    form.setFieldsValue({
      branchId: record.branchId || branchId,
      name: record.name,
      type: record.type,
      duration: record.duration,
      price: record.price,
      description: record.description,
      isActive: record.isActive
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    if (!branchId) {
      message.error("No branch selected.");
      return;
    }
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const payload = {
        branchId,
        name: values.name.trim(),
        type: values.type.trim(),
        duration: values.duration,
        price: values.price,
        description: (values.description ?? "").trim(),
        isActive: values.isActive ?? true
      };

      if (editing) {
        const { data } = await apiClient.patch<PlanResponse>(
          `/gym/membership-plans/${editing._id}`,
          payload,
          { params: { branchId } }
        );
        if (data.success) {
          message.success("Membership updated.");
          closeModal();
          await loadPlans();
        } else {
          message.error(data.message ?? "Update failed.");
        }
      } else {
        const { data } = await apiClient.post<PlanResponse>("/gym/membership-plans", payload);
        if (data.success) {
          message.success("Membership created.");
          closeModal();
          await loadPlans();
        } else {
          message.error(data.message ?? "Create failed.");
        }
      }
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (record: MembershipPlan) => {
    const bid = record.branchId || branchId;
    if (!bid) {
      message.error("Missing branch.");
      return;
    }
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(
        `/gym/membership-plans/${record._id}`,
        { params: { branchId: bid } }
      );
      if (data.success) {
        message.success("Membership deleted.");
        await loadPlans();
      } else {
        message.error(data.message ?? "Delete failed.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Delete failed.");
    }
  };

  const columns: ColumnsType<MembershipPlan> = useMemo(
    () => [
      {
        title: "Plan",
        dataIndex: "name",
        key: "name",
        ellipsis: true
      },
      {
        title: "Duration",
        dataIndex: "duration",
        key: "duration",
        width: 120,
        render: (v: number) => `${v} days`
      },
      {
        title: "Price (₹)",
        dataIndex: "price",
        key: "price",
        width: 130,
        render: (v: number) =>
          v.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
          })
      },
      {
        title: "Status",
        dataIndex: "isActive",
        key: "isActive",
        width: 110,
        render: (active: boolean) => (
          <span style={{ color: active ? token.colorSuccess : token.colorTextSecondary }}>
            {active ? "Active" : "Inactive"}
          </span>
        )
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        ellipsis: true
      },
      {
        title: "Actions",
        key: "actions",
        width: 100,
        fixed: "right",
        render: (_, record) => (
          <Space size="small">
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(record)} aria-label="Edit plan" />
            </Tooltip>
            <Popconfirm
              title="Delete this plan?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => void onDelete(record)}
            >
              <Tooltip title="Delete">
                <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete plan" />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [token.colorSuccess, token.colorTextSecondary]
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
          Memberships
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!branchId}>
          Create Membership
        </Button>
      </div>

      <Table<MembershipPlan>
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={plans}
        components={tableComponents}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 900 }}
      />

      <Modal
        title={editing ? "Edit Membership" : "Create New Membership"}
        open={modalOpen}
        onCancel={closeModal}
        width={WIDE_MODAL_WIDTH}
        footer={[
          <Button key="cancel" onClick={closeModal}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => void onSubmit()}>
            {editing ? "Save" : "Create Membership"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical" requiredMark style={{ marginTop: 8 }}>
          <Form.Item name="branchId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="Plan name"
            rules={[{ required: true, message: "Enter plan name" }]}
          >
            <Input placeholder="e.g. Monthly Plan" allowClear />
          </Form.Item>
          <Form.Item
            name="type"
            label="Membership type"
            rules={[{ required: true, message: "Enter membership type" }]}
          >
            <Input placeholder="e.g., monthly, quarterly, yearly, basic, premium, vip" allowClear />
          </Form.Item>
          <Form.Item
            name="duration"
            label="Duration (days)"
            rules={[{ required: true, message: "Enter duration in days" }]}
          >
            <InputNumber min={1} step={1} style={{ width: "100%" }} placeholder="Enter duration in days" />
          </Form.Item>
          <Form.Item
            name="price"
            label="Price (₹)"
            rules={[{ required: true, message: "Enter price" }]}
          >
            <InputNumber min={0} step={100} style={{ width: "100%" }} placeholder="Enter price" />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: "Enter description" }]}>
            <TextArea rows={3} placeholder="Enter membership description" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
