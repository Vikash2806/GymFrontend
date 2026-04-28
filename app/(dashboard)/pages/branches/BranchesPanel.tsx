"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Col,
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
  TeamOutlined,
} from "@ant-design/icons";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { BranchRow, BranchesListResponse, BranchMutationResponse } from "@/types/branch";
import { isValidIndianMobile, stripToIndianMobileDigits, toE164IndianMobile } from "@/utils/mobileValidation";
import { getCityOptions, getCountryOptions, getStateOptions } from "@/utils/options";
import { useAppDispatch } from "@/redux/hooks";
import { setSession } from "@/redux/features/auth/authSlice";
import type { SessionPayload } from "@/redux/features/auth/sessionTypes";
import ExportButton from "@/app/components/Export/ExportButton";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

const { Title, Text } = Typography;

const DEFAULT_COUNTRY_CODE = "IN";
const DEFAULT_STATE_CODE = "TN";
const DEFAULT_CITY_CODE = "TN_TNJ";

type FormValues = {
  name: string;
  line1: string;
  line2?: string;
  country: string;
  state: string;
  city: string;
  pincode?: string;
  phone: string;
  email?: string;
  status: "active" | "inactive";
};

function resolveOptionLabel(options: Array<{ value: string; label: string }>, rawValue: string | undefined): string {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return "";
  }
  const direct = options.find((option) => option.value === normalized);
  if (direct) {
    return direct.label;
  }
  const byLabel = options.find((option) => option.label.toLowerCase() === normalized.toLowerCase());
  return byLabel?.label ?? normalized;
}

function toOptionValue(options: Array<{ value: string; label: string }>, rawValue: string | undefined, fallback: string): string {
  const normalized = String(rawValue ?? "").trim();
  if (!normalized) {
    return fallback;
  }
  const direct = options.find((option) => option.value === normalized);
  if (direct) {
    return direct.value;
  }
  const byLabel = options.find((option) => option.label.toLowerCase() === normalized.toLowerCase());
  return byLabel?.value ?? fallback;
}

async function refreshSession(dispatch: ReturnType<typeof useAppDispatch>) {
  const { data } = await apiClient.get<SessionPayload>("/auth/me");
  dispatch(setSession(data));
}

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
  const [modalDirty, setModalDirty] = useState(false);
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();
  const countryOptions = useMemo(() => getCountryOptions("en", "code"), []);
  const stateOptions = useMemo(
    () => getStateOptions("en", DEFAULT_COUNTRY_CODE, "code"),
    []
  );
  const cityOptions = useMemo(
    () => getCityOptions("en", DEFAULT_STATE_CODE, DEFAULT_COUNTRY_CODE, "code"),
    []
  );
  const sectionTitleStyle: React.CSSProperties = { marginBottom: 12 };
  const sectionCardStyle: React.CSSProperties = {
    backgroundColor: token.colorBgBase,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16
  };
  const formatAddressForDisplay = useCallback((a: BranchRow["address"]): string => {
    const countryCode = String(a.country ?? "").trim();
    const stateCode = String(a.state ?? "").trim();
    const cityCode = String(a.city ?? "").trim();
    const normalizedCountryCode = countryCode || DEFAULT_COUNTRY_CODE;
    const normalizedStateCode = stateCode || DEFAULT_STATE_CODE;

    const countryLabel = resolveOptionLabel(getCountryOptions("en", "code"), countryCode);
    const stateLabel = resolveOptionLabel(
      getStateOptions("en", normalizedCountryCode, "code"),
      stateCode
    );
    const cityLabel = resolveOptionLabel(
      getCityOptions("en", normalizedStateCode, normalizedCountryCode, "code"),
      cityCode
    );

    const line = [a.line1, a.line2].filter(Boolean).join(", ");
    return [line, cityLabel, stateLabel, a.pincode, countryLabel].filter(Boolean).join(", ");
  }, []);

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
        country: toOptionValue(countryOptions, editing.address.country, DEFAULT_COUNTRY_CODE),
        state: toOptionValue(stateOptions, editing.address.state, DEFAULT_STATE_CODE),
        city: toOptionValue(cityOptions, editing.address.city, DEFAULT_CITY_CODE),
        pincode: editing.address.pincode,
        phone: stripToIndianMobileDigits(editing.contact.phone),
        email: editing.contact.email ?? undefined,
        status: editing.status
      });
      setModalDirty(false);
      clearDirty("branches-modal");
    } else {
      form.resetFields();
      form.setFieldsValue({
        country: DEFAULT_COUNTRY_CODE,
        state: DEFAULT_STATE_CODE,
        city: DEFAULT_CITY_CODE,
        status: "active"
      });
      setModalDirty(false);
      clearDirty("branches-modal");
    }
  }, [modalOpen, editing, form, clearDirty, countryOptions, stateOptions, cityOptions]);

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
          phone: toE164IndianMobile(values.phone) ?? values.phone.trim(),
          email: values.email?.trim() ? values.email.trim() : null
        },
        address: {
          line1: values.line1.trim(),
          line2: (values.line2 ?? "").trim(),
          country: values.country.trim(),
          state: values.state.trim(),
          city: values.city.trim(),
          pincode: (values.pincode ?? "").trim()
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
      setModalDirty(false);
      clearDirty("branches-modal");
      await load();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in (e as object)) {
        return;
      }
      message.error(extractApiErrorMessage(e) ?? "Request failed.");
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
      width: 220,
      ellipsis: true,
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
      width: 280,
      ellipsis: true,
      render: (_, record) => (
        <Space align="start">
          <EnvironmentOutlined style={{ color: token.colorTextSecondary, marginTop: 2 }} />
          <Text>{formatAddressForDisplay(record.address)}</Text>
        </Space>
      )
    },
    {
      title: "Contact",
      key: "contact",
      width: 160,
      render: (_, record) => (
        <Space>
          <PhoneOutlined style={{ color: token.colorTextSecondary }} />
          <Text>{record.contact.phone}</Text>
        </Space>
      )
    },
    {
      title: "Manager",
      key: "managers",
      width: 220,
      render: (_, record) =>
        record.managers.length > 0 ? (
          <Space direction="vertical" size={0}>
            {record.managers.map((manager) => (
              <Text key={manager.id}>
                {manager.fullName}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {" "}
                  ({manager.status === "active" ? "Active" : "Inactive"})
                </Text>
              </Text>
            ))}
          </Space>
        ) : (
          <Text type="secondary">Not Assigned</Text>
        )
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
      fixed: "right",
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
          <Space wrap>
            <ExportButton endpoint="/gym/exports/branches" defaultFilename="branches.csv" />
            {/* <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add Branch
            </Button> */}
          </Space>
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
              showQuickJumper: true,
              pageSizeOptions: ["10", "25", "50", "100"],
              size: "small",
              showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} branches`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              }
            }}
            scroll={{ x: 1100, y: "calc(100vh - 120px)" }}
            tableLayout="fixed"
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
          const closeModal = () => {
            setModalOpen(false);
            setEditing(null);
            setModalDirty(false);
            clearDirty("branches-modal");
          };
          if (modalDirty) {
            confirmNavigation(closeModal);
            return;
          }
          closeModal();
        }}
        destroyOnHidden
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              const closeModal = () => {
                setModalOpen(false);
                setEditing(null);
                setModalDirty(false);
                clearDirty("branches-modal");
              };
              if (modalDirty) {
                confirmNavigation(closeModal);
                return;
              }
              closeModal();
            }}
          >
            Cancel
          </Button>,
          <Button key="ok" type="primary" loading={submitting} onClick={() => void onSubmit()}>
            {editing ? "Update" : "Create"}
          </Button>
        ]}
        width={WIDE_MODAL_WIDTH}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          style={{ marginTop: 8 }}
          onValuesChange={() => {
            setModalDirty(true);
            setDirty("branches-modal", true);
          }}
        >
          <Title level={5} style={sectionTitleStyle}>Basic details</Title>
          <div style={sectionCardStyle}>
            <Form.Item name="name" label="Branch Name" rules={[{ required: true, message: "Required" }]}>
              <Input placeholder="Branch name" allowClear />
            </Form.Item>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" }
                ]}
              />
            </Form.Item>
          </div>

          <Title level={5} style={sectionTitleStyle}>Address</Title>
          <div style={sectionCardStyle}>
            <Form.Item name="line1" label="Street" rules={[{ required: false, message: "Required" }]}>
              <Input placeholder="Street address" allowClear />
            </Form.Item>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="country" label="Country" rules={[{ required: true, message: "Required" }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={countryOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="state" label="State" rules={[{ required: true, message: "Required" }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={stateOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="city" label="City" rules={[{ required: true, message: "Required" }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select city / district"
                    options={cityOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="pincode" label="Zip / Pin Code (optional)">
                  <Input placeholder="Pin code" allowClear />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="line2" label="Address line 2 (optional)" style={{ marginBottom: 0 }}>
              <Input placeholder="Apartment, suite, etc." allowClear />
            </Form.Item>
          </div>

          <Title level={5} style={sectionTitleStyle}>Contact</Title>
          <div style={sectionCardStyle}>
            <Form.Item
              label="Phone"
              extra="Indian mobile (+91)"
            >
              <Space.Compact style={{ width: "100%" }}>
                <Input
                  readOnly
                  tabIndex={-1}
                  value="+91"
                  style={{ width: 64, textAlign: "center" }}
                  aria-label="Country code India"
                />
                <Form.Item
                  name="phone"
                  noStyle
                  getValueFromEvent={(e) => stripToIndianMobileDigits(e.target?.value ?? e)}
                  rules={[
                    { required: true, message: "Required" },
                    {
                      validator: async (_, value) => {
                        const digits = stripToIndianMobileDigits(value);
                        if (!isValidIndianMobile(digits)) {
                          throw new Error("Enter a valid 10-digit Indian mobile number");
                        }
                      }
                    }
                  ]}
                >
                  <Input
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="Enter 10 Digit Mobile Number"
                    allowClear
                    style={{ width: "calc(100% - 64px)" }}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>

            <Form.Item name="email" label="Email (optional)" style={{ marginBottom: 0 }}>
              <Input type="email" placeholder="branch@example.com" allowClear />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
