"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { DeleteOutlined, EditOutlined, UserAddOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { canAccessStaffUsersModule, gymMembershipRoleFromSession } from "@/utils/gymRole";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { isValidIndianMobile, stripToIndianMobileDigits, toE164IndianMobile } from "@/utils/mobileValidation";
import { normalizeOptionalEmail } from "@/utils/emailValidation";
import type { StaffUserMutationResponse, StaffUserRow, StaffUsersListResponse } from "@/types/staffUser";
import { useRouter } from "next/navigation";
import ExportButton from "@/app/components/Export/ExportButton";

const { Title, Text } = Typography;

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<StaffUserRow>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

type FormValues = {
  role: "manager" | "staff";
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  password?: string;
  branchId: string;
  status?: "active" | "inactive";
};

function splitFullName(full: string): { firstName: string; lastName: string } {
  const t = full.trim();
  const i = t.indexOf(" ");
  if (i === -1) {
    return { firstName: t, lastName: "" };
  }
  return { firstName: t.slice(0, i).trim(), lastName: t.slice(i + 1).trim() };
}

function formatCreatedAt(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY HH:mm") : "—";
}

export default function StaffManagerPanel() {
  const { message } = App.useApp();
  const router = useRouter();
  const session = useAppSelector(selectSession);
  const membershipRole = gymMembershipRoleFromSession(session);
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const branchOptions = session?.gym?.branches ?? [];

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState<"all" | "manager" | "staff">("all");
  const [branchFilter, setBranchFilter] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const canAccess = canAccessStaffUsersModule(session);
  const canCreateStaff = hasFeature(session, FEATURES.STAFF_MANAGEMENT);
  const canUpdateStaff = hasFeature(session, FEATURES.STAFF_MANAGEMENT);

  useEffect(() => {
    if (!canAccess) {
      router.replace("/pages/dashboard");
    }
  }, [canAccess, router]);

  useEffect(() => {
    if (defaultBranchId && branchFilter !== defaultBranchId) {
      setBranchFilter(defaultBranchId);
      setPage(1);
    }
  }, [defaultBranchId, branchFilter]);

  const load = useCallback(async () => {
    if (!canAccess) {
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.get<StaffUsersListResponse>("/gym/staff-users", {
        params: {
          page,
          pageSize,
          role: roleFilter,
          branchId: branchFilter || undefined
        }
      });
      if (!data.success) {
        message.error(data.message ?? "Could not load staff.");
        return;
      }
      setRows(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch {
      message.error("Could not load staff.");
    } finally {
      setLoading(false);
    }
  }, [canAccess, message, page, pageSize, roleFilter, branchFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = membershipRole === "owner";

  const roleSelectOptions = useMemo(() => {
    if (isOwner) {
      return [
        { value: "manager" as const, label: "Manager" },
        { value: "staff" as const, label: "Staff" }
      ];
    }
    return [{ value: "staff" as const, label: "Staff" }];
  }, [isOwner]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: StaffUserRow) => {
    setEditing(record);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (editing) {
      const { firstName, lastName } = splitFullName(editing.fullName);
      form.setFieldsValue({
        role: editing.role === "manager" || editing.role === "staff" ? editing.role : "staff",
        firstName,
        lastName,
        phone: editing.phone.replace(/^\+91/, ""),
        email: editing.email?.trim() ? editing.email : undefined,
        branchId: editing.branch.id,
        status: editing.status,
        password: undefined
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        role: isOwner ? "manager" : "staff",
        branchId: defaultBranchId || undefined,
        firstName: "",
        lastName: "",
        phone: "",
        email: undefined,
        password: ""
      });
    }
  }, [modalOpen, editing, form, defaultBranchId, isOwner]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const e164 = toE164IndianMobile(values.phone);
      if (!e164 || !isValidIndianMobile(values.phone)) {
        message.error("Please enter a valid Indian mobile number.");
        setSubmitting(false);
        return;
      }

      if (editing) {
        const payload: Record<string, unknown> = {
          firstName: values.firstName.trim(),
          lastName: (values.lastName ?? "").trim(),
          role: values.role,
          branchId: values.branchId,
          status: values.status ?? "active"
        };
        const em = String(values.email ?? "").trim();
        payload.email = em === "" ? "" : normalizeOptionalEmail(em) ?? "";
        if (values.password && values.password.trim().length > 0) {
          payload.password = values.password.trim();
        }
        const { data } = await apiClient.patch<StaffUserMutationResponse>(
          `/gym/staff-users/${editing.id}`,
          payload
        );
        if (!data.success) {
          message.error(data.message ?? "Update failed.");
          return;
        }
        message.success("User updated.");
      } else {
        const emailNorm = normalizeOptionalEmail(values.email);
        const createBody: Record<string, unknown> = {
          firstName: values.firstName.trim(),
          lastName: (values.lastName ?? "").trim(),
          mobileNumber: e164,
          password: values.password?.trim() ?? "",
          role: values.role,
          branchId: values.branchId
        };
        if (emailNorm) {
          createBody.email = emailNorm;
        }
        const { data } = await apiClient.post<StaffUserMutationResponse>("/gym/staff-users", createBody);
        if (!data.success) {
          message.error(data.message ?? "Create failed.");
          return;
        }
        message.success("User created.");
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch {
      message.error("Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (record: StaffUserRow) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(
        `/gym/staff-users/${record.id}`
      );
      if (!data.success) {
        message.error(data.message ?? "Delete failed.");
        return;
      }
      message.success("User deactivated.");
      await load();
    } catch {
      message.error("Delete failed.");
    }
  };

  const columns: ColumnsType<StaffUserRow> = [
    {
      title: "Name",
      dataIndex: "fullName",
      key: "fullName",
      ellipsis: true
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      render: (p: string) => <Text copyable={{ text: p }}>{p}</Text>
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 110,
      render: (r: StaffUserRow["role"]) =>
        r ? <Tag color={r === "manager" ? "blue" : "default"}>{r === "manager" ? "Manager" : "Staff"}</Tag> : "—"
    },
    {
      title: "Branch",
      key: "branch",
      ellipsis: true,
      render: (_, row) => (
        <span>
          {row.branch.code ? `${row.branch.code} — ` : ""}
          {row.branch.name || row.branch.id}
        </span>
      )
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={s === "active" ? "green" : "default"}>{s === "active" ? "Active" : "Inactive"}</Tag>
      )
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (iso: string) => formatCreatedAt(iso)
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
            disabled={!canUpdateStaff}
          >
            Edit
          </Button>
          <Popconfirm
            title="Deactivate this user?"
            description="They will not be able to sign in while inactive."
            okText="Deactivate"
            cancelText="Cancel"
            onConfirm={() => void onDelete(record)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={!canUpdateStaff}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (!canAccess) {
    return null;
  }

  return (
    <Card>
      <Flex justify="space-between" align="center" wrap="wrap" gap={16} style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Staff/Manager
        </Title>
        <Space wrap>
          <Select
            value={roleFilter}
            onChange={(v) => {
              setRoleFilter(v);
              setPage(1);
            }}
            style={{ width: 120 }}
            options={[
              { value: "all", label: "All" },
              { value: "manager", label: "Manager" },
              { value: "staff", label: "Staff" }
            ]}
          />
          <Select
            allowClear
            placeholder="Branch filter"
            value={branchFilter || undefined}
            onChange={(v) => {
              setBranchFilter(v ?? "");
              setPage(1);
            }}
            style={{ minWidth: 180 }}
            options={branchOptions.map((b) => ({
              value: b.id,
              label: `${b.code} — ${b.name}`
            }))}
          />
          <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate} disabled={!canCreateStaff}>
            Create User
          </Button>
          <ExportButton
            endpoint="/gym/staff-users/export"
            params={{
              role: roleFilter,
              branchId: branchFilter || undefined
            }}
            defaultFilename="staff-users.csv"
          />
        </Space>
      </Flex>

      <Table<StaffUserRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        components={tableComponents}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          }
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  No staff found
                  <br />
                  <Text type="secondary">Add users using the &apos;Create User&apos; button above.</Text>
                </span>
              }
            />
          )
        }}
        scroll={{ x: 960 }}
      />

      <Modal
        title={editing ? "Edit User" : "Create User"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onOk={() => void onSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={WIDE_MODAL_WIDTH}
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Select a role" }]}
          >
            <Select options={roleSelectOptions} />
          </Form.Item>
          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input autoComplete="given-name" />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Last Name"
          >
            <Input autoComplete="family-name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email (optional)"
            rules={[
              {
                validator: async (_, v) => {
                  const s = String(v ?? "").trim();
                  if (!s) {
                    return;
                  }
                  if (!normalizeOptionalEmail(s)) {
                    throw new Error("Enter a valid email address");
                  }
                }
              }
            ]}
          >
            <Input
              type="email"
              placeholder="Optional — recovery or contact"
              allowClear
              autoComplete="email"
            />
          </Form.Item>
          <Form.Item label="Phone" required>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                readOnly
                tabIndex={-1}
                value="+91"
                style={{ width: 64, textAlign: "center" }}
                disabled={Boolean(editing)}
              />
              <Form.Item
                name="phone"
                noStyle
                rules={[
                  { required: true, message: "Required" },
                  {
                    validator: async (_, v) => {
                      const s = String(v ?? "");
                      if (!isValidIndianMobile(s)) {
                        throw new Error("Enter a valid Indian mobile number");
                      }
                    }
                  }
                ]}
                getValueFromEvent={(e) => stripToIndianMobileDigits(e.target?.value ?? e)}
              >
                <Input placeholder="10-digit mobile" maxLength={10} disabled={Boolean(editing)} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? "Password (leave blank to keep)" : "Password"}
            rules={
              editing
                ? []
                : [{ required: true, message: "Password is required" }, { min: 6, message: "At least 6 characters" }]
            }
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="branchId"
            label="Branch Assignment"
            rules={[{ required: true, message: "Select a branch" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={branchOptions.map((b) => ({
                value: b.id,
                label: `${b.code} — ${b.name}`
              }))}
            />
          </Form.Item>
          {editing ? (
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" }
                ]}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </Card>
  );
}
