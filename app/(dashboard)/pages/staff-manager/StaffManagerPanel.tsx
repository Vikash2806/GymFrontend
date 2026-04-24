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
import { FEATURES, getFirstAccessibleRoute, hasFeature } from "@/utils/permissions";
import { isValidIndianMobile, stripToIndianMobileDigits, toE164IndianMobile } from "@/utils/mobileValidation";
import { normalizeOptionalEmail } from "@/utils/emailValidation";
import { PASSWORD_MIN_LENGTH_MESSAGE, validateOptionalPasswordMinLength } from "@/utils/passwordValidation";
import type { StaffUserMutationResponse, StaffUserRow, StaffUsersListResponse } from "@/types/staffUser";
import { useRouter } from "next/navigation";
import ExportButton from "@/app/components/Export/ExportButton";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

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
  branchIds: string[];
  status?: "active" | "inactive";
};

function extractApiErrorMessage(error: unknown): string | null {
  if (!(error && typeof error === "object" && "response" in error)) {
    return null;
  }
  const payload = (error as { response?: { data?: { message?: unknown; errors?: unknown } } }).response?.data;
  const msg = payload?.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg;
  }
  if (Array.isArray(payload?.errors)) {
    const firstError = payload.errors[0];
    if (typeof firstError === "string" && firstError.trim()) {
      return firstError;
    }
    if (
      firstError &&
      typeof firstError === "object" &&
      "message" in firstError &&
      typeof (firstError as { message?: unknown }).message === "string" &&
      (firstError as { message: string }).message.trim()
    ) {
      return (firstError as { message: string }).message;
    }
  }
  return null;
}

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
  const isOwner = membershipRole === "owner";
  const gymId = session?.user?.defaults?.gymId ?? session?.gym?.id ?? "";
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const branchOptions = useMemo(() => {
    const allBranches = (session?.gym?.branches ?? []).filter((branch) => {
      const branchStatus = (branch as { status?: string }).status;
      return !branchStatus || branchStatus === "active";
    });
    if (isOwner) {
      return allBranches;
    }
    const membership = session?.user?.associatedGyms?.find((g) => g.gymId === gymId);
    const allowedBranchIds = new Set((membership?.branches ?? []).map((entry) => entry.branchId));
    if (allowedBranchIds.size === 0) {
      if (defaultBranchId) {
        return allBranches.filter((branch) => branch.id === defaultBranchId);
      }
      return [];
    }
    return allBranches.filter((branch) => allowedBranchIds.has(branch.id));
  }, [session?.gym?.branches, session?.user?.associatedGyms, gymId, isOwner, defaultBranchId]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roleFilter, setRoleFilter] = useState<"all" | "manager" | "staff">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalDirty, setModalDirty] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();

  const canAccess = canAccessStaffUsersModule(session);
  const canCreateStaff = hasFeature(session, FEATURES.STAFF_MANAGEMENT);
  const canUpdateStaff = hasFeature(session, FEATURES.STAFF_MANAGEMENT);

  useEffect(() => {
    if (!canAccess) {
      router.replace(getFirstAccessibleRoute(session));
    }
  }, [canAccess, router, session]);

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
          search: searchQuery || undefined,
          branchId: defaultBranchId || undefined
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
  }, [canAccess, message, page, pageSize, roleFilter, searchQuery, defaultBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [roleFilter, searchQuery]);

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
    setModalDirty(false);
    clearDirty("staff-manager-modal");
  };

  const openEdit = (record: StaffUserRow) => {
    setEditing(record);
    setModalOpen(true);
    setModalDirty(false);
    clearDirty("staff-manager-modal");
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
        branchIds:
          editing.branches && editing.branches.length > 0
            ? editing.branches.map((branch) => branch.id)
            : [editing.branch.id],
        status: editing.status,
        password: undefined
      });
      setModalDirty(false);
      clearDirty("staff-manager-modal");
    } else {
      form.resetFields();
      form.setFieldsValue({
        role: isOwner ? "manager" : "staff",
        branchIds: defaultBranchId ? [defaultBranchId] : [],
        firstName: "",
        lastName: "",
        phone: "",
        email: undefined,
        password: ""
      });
      setModalDirty(false);
      clearDirty("staff-manager-modal");
    }
  }, [modalOpen, editing, form, defaultBranchId, isOwner, clearDirty]);

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
          mobileNumber: e164,
          role: values.role,
          branchIds: values.branchIds,
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
          branchIds: values.branchIds
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
      setModalDirty(false);
      clearDirty("staff-manager-modal");
      await load();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      message.error(extractApiErrorMessage(e) ?? "Request failed.");
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
      title: "Branches",
      key: "branches",
      render: (_, row) => {
        const assignedBranches = row.branches?.length
          ? row.branches
          : row.branch?.id
            ? [row.branch]
            : [];
        if (assignedBranches.length === 0) {
          return "—";
        }
        return (
          <Space size={[6, 6]} wrap>
            {assignedBranches.map((branch) => (
              <Tag key={branch.id}>
                {branch.code ? `${branch.code} — ` : ""}
                {branch.name || branch.id}
              </Tag>
            ))}
          </Space>
        );
      }
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
            aria-label="Edit user"
          />
          <Popconfirm
            title="Deactivate this user?"
            description="They will not be able to sign in while inactive."
            okText="Deactivate"
            cancelText="Cancel"
            onConfirm={() => void onDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!canUpdateStaff}
              aria-label="Deactivate user"
            />
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
          <Input
            allowClear
            placeholder="Search name, phone or email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 240 }}
          />
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
          <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate} disabled={!canCreateStaff}>
            Create User
          </Button>
          <ExportButton
            endpoint="/gym/staff-users/export"
            params={{
              role: roleFilter,
              search: searchQuery || undefined,
              branchId: defaultBranchId || undefined
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
          showQuickJumper: true,
          pageSizeOptions: ["10", "25", "50", "100"],
          showTotal: (value, range) => `${range[0]}-${range[1]} of ${value} staff`,
          size: "small",
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
          const closeModal = () => {
            setModalOpen(false);
            setEditing(null);
            setModalDirty(false);
            clearDirty("staff-manager-modal");
          };
          if (modalDirty) {
            confirmNavigation(closeModal);
            return;
          }
          closeModal();
        }}
        onOk={() => void onSubmit()}
        confirmLoading={submitting}
        destroyOnHidden
        width={WIDE_MODAL_WIDTH}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          onValuesChange={() => {
            setModalDirty(true);
            setDirty("staff-manager-modal", true);
          }}
        >
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
                <Input placeholder="10-digit mobile" maxLength={10} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? "Password (leave blank to keep)" : "Password"}
            rules={
              editing
                ? [{ validator: validateOptionalPasswordMinLength }]
                : [
                    { required: true, message: "Password is required" },
                    { validator: validateOptionalPasswordMinLength, message: PASSWORD_MIN_LENGTH_MESSAGE }
                  ]
            }
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="branchIds"
            label="Branch Assignments"
            rules={[
              { required: true, message: "Select at least one branch" },
              {
                validator: async (_, value) => {
                  if (!Array.isArray(value) || value.length === 0) {
                    throw new Error("Select at least one branch");
                  }
                }
              }
            ]}
          >
            <Select
              mode="multiple"
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
