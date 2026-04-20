"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BankOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  PhoneOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { BranchRow, BranchesListResponse, BranchMutationResponse } from "@/types/branch";
import { INDIAN_STATES } from "@/utils/indianStates";
import { useAppDispatch } from "@/redux/hooks";
import { patchSessionToken, setSession } from "@/redux/features/auth/authSlice";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";

const { Title, Text } = Typography;

type FormValues = {
  name: string;
  line1: string;
  line2?: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  phone: string;
  email?: string;
  status: "active" | "inactive";
};

function formatAddress(a: BranchRow["address"]): string {
  const line = [a.line1, a.line2].filter(Boolean).join(", ");
  return [line, a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ");
}

async function refreshSession(dispatch: ReturnType<typeof useAppDispatch>) {
  const { data } = await apiClient.get<SessionPayload>("/auth/me");
  dispatch(setSession(data));
}

export default function BranchesPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const [form] = Form.useForm<FormValues>();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalBranches: 0, activeBranches: 0, totalMembers: 0 });
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<BranchesListResponse>("/gym/branches", {
        params: { page, pageSize }
      });
      if (!data.success) {
        message.error(data.message ?? "Could not load branches.");
        return;
      }
      setStats(data.stats);
      setRows(data.branches);
      setTotal(data.total);
    } catch {
      message.error("Could not load branches.");
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Form lives inside Modal; only set values after the modal (and Form) is mounted to avoid useForm disconnect warnings. */
  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        line1: editing.address.line1,
        line2: editing.address.line2 || undefined,
        country: editing.address.country || "India",
        state: editing.address.state,
        city: editing.address.city,
        pincode: editing.address.pincode,
        phone: editing.contact.phone,
        email: editing.contact.email ?? undefined,
        status: editing.status
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        country: "India",
        status: "active"
      });
    }
  }, [modalOpen, editing, form]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: BranchRow) => {
    setEditing(record);
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        contact: {
          phone: values.phone.trim(),
          email: values.email?.trim() ? values.email.trim() : null
        },
        address: {
          line1: values.line1.trim(),
          line2: (values.line2 ?? "").trim(),
          country: values.country.trim(),
          state: values.state.trim(),
          city: values.city.trim(),
          pincode: values.pincode.trim()
        },
        status: values.status
      };

      if (editing) {
        const { data } = await apiClient.patch<BranchMutationResponse>(
          `/gym/branches/${editing.id}`,
          payload
        );
        if (!data.success) {
          message.error(data.message ?? "Update failed.");
          return;
        }
        message.success("Branch updated.");
        if (data.token) {
          dispatch(patchSessionToken({ token: data.token }));
        }
        await refreshSession(dispatch);
      } else {
        const { data } = await apiClient.post<BranchMutationResponse>("/gym/branches", payload);
        if (!data.success) {
          message.error(data.message ?? "Could not create branch.");
          return;
        }
        message.success("Branch created.");
        await refreshSession(dispatch);
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in (e as object)) {
        return;
      }
      message.error("Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (record: BranchRow) => {
    try {
      const { data } = await apiClient.delete<BranchMutationResponse>(`/gym/branches/${record.id}`);
      if (!data.success) {
        message.error(data.message ?? "Delete failed.");
        return;
      }
      message.success("Branch deleted.");
      if (data.token) {
        dispatch(patchSessionToken({ token: data.token }));
      }
      await refreshSession(dispatch);
      await load();
    } catch {
      message.error("Delete failed.");
    }
  };

  const columns: ColumnsType<BranchRow> = [
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <Space align="center">
          <Flex
            align="center"
            justify="center"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              flexShrink: 0
            }}
          >
            <HomeOutlined />
          </Flex>
          <Text strong>{record.name}</Text>
        </Space>
      )
    },
    {
      title: "Address",
      key: "address",
      ellipsis: true,
      render: (_, record) => (
        <Space align="start">
          <EnvironmentOutlined style={{ color: token.colorTextSecondary, marginTop: 2 }} />
          <Text>{formatAddress(record.address)}</Text>
        </Space>
      )
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, record) => (
        <Space>
          <PhoneOutlined style={{ color: token.colorTextSecondary }} />
          <Text>{record.contact.phone}</Text>
        </Space>
      )
    },
    {
      title: "Manager",
      key: "manager",
      render: () => <Text type="secondary">Not Assigned</Text>
    },
    {
      title: "Members",
      dataIndex: "memberCount",
      key: "memberCount",
      width: 100,
      align: "center"
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      align: "center",
      render: (_, record) => (
        <Tag color={record.status === "active" ? "success" : "default"}>
          {record.status === "active" ? "Active" : "Inactive"}
        </Tag>
      )
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label="Edit branch"
            onClick={() => openEdit(record)}
            style={{ color: token.colorPrimary }}
          />
          <Popconfirm
            title="Delete this branch?"
            description="Only allowed when the branch has no members."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(record)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete branch" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ paddingBottom: 8 }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={12} style={{ marginBottom: 20 }}>
          <Title level={3} style={{ margin: 0 }}>
            Branches Management
          </Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Branch
          </Button>
        </Flex>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <Card variant="borderless" styles={{ body: { padding: "20px 24px" } }}>
              <Statistic
                title="Total Branches"
                value={stats.totalBranches}
                prefix={<BankOutlined style={{ color: token.colorPrimary }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card variant="borderless" styles={{ body: { padding: "20px 24px" } }}>
              <Statistic
                title="Active Branches"
                value={stats.activeBranches}
                prefix={<HomeOutlined style={{ color: token.colorSuccess }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card variant="borderless" styles={{ body: { padding: "20px 24px" } }}>
              <Statistic
                title="Total Members"
                value={stats.totalMembers}
                prefix={<TeamOutlined style={{ color: token.colorInfo }} />}
              />
            </Card>
          </Col>
        </Row>

        <Card variant="borderless" styles={{ body: { padding: 16 } }}>
          <Table<BranchRow>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} branches`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              }
            }}
            scroll={{ x: true }}
          />
        </Card>
      </div>

      <Modal
        title={
          <Space>
            <BankOutlined />
            <span>Branch</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        destroyOnHidden
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setModalOpen(false);
              setEditing(null);
            }}
          >
            Cancel
          </Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={() => void onSubmit()}>
            {editing ? "Update" : "Create"}
          </Button>
        ]}
        width={WIDE_MODAL_WIDTH}
      >
        <Form form={form} layout="vertical" requiredMark style={{ marginTop: 8 }}>
          <Form.Item name="name" label="Branch Name" rules={[{ required: true, message: "Required" }]}>
            <Input placeholder="Branch name" allowClear />
          </Form.Item>

          <Divider plain>Address</Divider>

          <Form.Item name="line1" label="Street" rules={[{ required: true, message: "Required" }]}>
            <Input placeholder="Street address" allowClear />
          </Form.Item>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="country" label="Country" rules={[{ required: true, message: "Required" }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={[{ value: "India", label: "India" }]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="state" label="State" rules={[{ required: true, message: "Required" }]}>
                <Select
                  showSearch
                  placeholder="Select state"
                  optionFilterProp="label"
                  options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="City" rules={[{ required: true, message: "Required" }]}>
                <Input placeholder="City" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="pincode" label="Zip / Pin Code" rules={[{ required: true, message: "Required" }]}>
                <Input placeholder="Pin code" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="line2" label="Address line 2 (optional)">
            <Input placeholder="Apartment, suite, etc." allowClear />
          </Form.Item>

          <Divider plain>Contact</Divider>

          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ required: true, message: "Required" }]}
            extra="Indian mobile (+91)"
          >
            <Input placeholder="+91 9876543210" allowClear />
          </Form.Item>

          <Form.Item name="email" label="Email (optional)">
            <Input type="email" placeholder="branch@example.com" allowClear />
          </Form.Item>

          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
