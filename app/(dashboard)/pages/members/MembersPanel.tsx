"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App,
  Avatar,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  PhoneOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  UploadOutlined
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { Member } from "@/types/member";
import type { MembershipPlan } from "@/types/membership";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { stripToIndianMobileDigits } from "@/utils/mobileValidation";
import { formatInrWhole } from "@/utils/formatCurrency";
import { FEATURES, hasFeature } from "@/utils/permissions";
import ExportButton from "@/app/components/Export/ExportButton";

const { Title, Text } = Typography;

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<Member>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

function formatDisplayDate(iso: string | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY") : "—";
}

type ListResponse = { success: boolean; members?: Member[]; message?: string };
type MemberResponse = { success: boolean; member?: Member; message?: string };
type PlansResponse = { success: boolean; plans?: MembershipPlan[]; message?: string };
type MemberLookupResponse = {
  success: boolean;
  found?: boolean;
  member?: Member | null;
  message?: string;
};
type SubscriptionCreateResponse = { success: boolean; message?: string };

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

function billingCell(m: Member, token: { colorWarning: string }) {
  const p = m.currentSubscription?.payment;
  if (!p) {
    return <Text type="secondary">—</Text>;
  }
  const sub = m.currentSubscription;
  const endLabel = sub ? formatDisplayDate(sub.endDate) : "—";
  if (p.status === "paid") {
    return (
      <Space direction="vertical" size={0}>
        <Text>Paid</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {endLabel}
        </Text>
      </Space>
    );
  }
  return (
    <Space direction="vertical" size={0}>
      <Space size={4}>
        <ClockCircleOutlined style={{ color: token.colorWarning }} />
        <Text>{formatInrWhole(p.pendingAmount)}</Text>
      </Space>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {endLabel}
      </Text>
    </Space>
  );
}

type FormShape = {
  branchId: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  gender: string;
  dob?: Dayjs | null;
  dateOfJoining: Dayjs;
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  planId?: string;
  paidAmount?: number;
  paymentMethod: "cash" | "upi" | "card";
  emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
  notes?: string;
};

type MembersPanelProps = {
  onMemberCountChange?: (count: number) => void;
};

export default function MembersPanel({ onMemberCountChange }: MembersPanelProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const canManageBranches = hasFeature(session, FEATURES.BRANCH_MANAGEMENT);
  const canCreateMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const canUpdateMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const canDeleteMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const assignedBranchId = session?.user?.defaults?.branchId ?? "";
  const defaultBranchId = canManageBranches
    ? session?.activeBranch?.id ?? assignedBranchId
    : assignedBranchId || session?.activeBranch?.id || "";

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [branchFilter, setBranchFilter] = useState<string>(defaultBranchId);
  const [nameSearch, setNameSearch] = useState("");
  const [debouncedNameSearch, setDebouncedNameSearch] = useState("");
  const effectiveBranchId = canManageBranches ? branchFilter : defaultBranchId;

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarList, setAvatarList] = useState<UploadFile[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMember, setLookupMember] = useState<Member | null>(null);
  const [lookupNote, setLookupNote] = useState<string>("");
  const planRequestSeq = useRef(0);
  const [form] = Form.useForm<FormShape>();
  const watchedPhone = Form.useWatch("phone", form);
  const watchedBranchId = Form.useWatch("branchId", form);

  useEffect(() => {
    if (branchFilter !== defaultBranchId) {
      setBranchFilter(defaultBranchId);
      return;
    }
  }, [defaultBranchId, branchFilter]);

  const loadPlans = useCallback(async (branchId: string) => {
    if (!branchId) {
      setPlans([]);
      return;
    }
    const requestId = ++planRequestSeq.current;
    try {
      const { data } = await apiClient.get<PlansResponse>("/gym/membership-plans", {
        params: { branchId }
      });
      if (requestId !== planRequestSeq.current) {
        return;
      }
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans.filter((p) => p.isActive));
      } else {
        setPlans([]);
      }
    } catch {
      if (requestId !== planRequestSeq.current) {
        return;
      }
      setPlans([]);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!effectiveBranchId) {
      setMembers([]);
      onMemberCountChange?.(0);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { branchId: effectiveBranchId };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      const { data } = await apiClient.get<ListResponse>("/gym/members", { params });
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
        onMemberCountChange?.(data.members.length);
      } else {
        setMembers([]);
        onMemberCountChange?.(0);
        if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load members.");
      setMembers([]);
      onMemberCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, statusFilter, onMemberCountChange, message]);

  const planBranchId = useMemo(() => {
    if (editing) {
      return "";
    }
    if (typeof watchedBranchId === "string" && watchedBranchId) {
      return watchedBranchId;
    }
    return effectiveBranchId || defaultBranchId || "";
  }, [editing, watchedBranchId, effectiveBranchId, defaultBranchId]);

  useEffect(() => {
    if (editing) {
      setPlans([]);
      return;
    }
    void loadPlans(planBranchId);
  }, [editing, planBranchId, loadPlans]);

  useEffect(() => {
    if (editing || !modalOpen) {
      return;
    }
    const selectedPlan = form.getFieldValue("planId");
    if (selectedPlan && !plans.some((p) => p._id === selectedPlan)) {
      form.setFieldsValue({ planId: undefined, paidAmount: 0 });
    }
  }, [editing, modalOpen, plans, form]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedNameSearch(nameSearch.trim().toLowerCase());
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [nameSearch]);

  const branchOptions = useMemo(() => {
    const br = session?.gym?.branches ?? [];
    const visibleBranches = canManageBranches ? br : br.filter((branch) => branch.id === defaultBranchId);
    return visibleBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  }, [session?.gym?.branches, canManageBranches, defaultBranchId]);

  const planOptions = useMemo(
    () =>
      plans.map((p) => ({
        value: p._id,
        label: `${p.name} — ₹${p.price.toLocaleString("en-IN")} / ${p.duration}d`
      })),
    [plans]
  );

  const reloadPlansForOpenDropdown = useCallback(() => {
    if (editing) {
      return;
    }
    const selectedBranch = String(form.getFieldValue("branchId") ?? "");
    const fallbackBranch = effectiveBranchId || defaultBranchId || "";
    const targetBranchId = selectedBranch || fallbackBranch;
    if (!targetBranchId) {
      return;
    }
    void loadPlans(targetBranchId);
  }, [editing, form, effectiveBranchId, defaultBranchId, loadPlans]);

  const displayedMembers = useMemo(() => {
    if (!debouncedNameSearch) {
      return members;
    }
    const digitsQuery = debouncedNameSearch.replace(/\D/g, "");
    return members.filter((member) => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const memberPhone = member.profile.phone ?? "";
      return (
        fullName.includes(debouncedNameSearch) ||
        member.firstName.toLowerCase().includes(debouncedNameSearch) ||
        member.lastName.toLowerCase().includes(debouncedNameSearch) ||
        (digitsQuery.length > 0 && memberPhone.includes(digitsQuery))
      );
    });
  }, [members, debouncedNameSearch]);

  const openCreate = () => {
    setEditing(null);
    setAvatarList([]);
    setLookupMember(null);
    setLookupNote("");
    form.resetFields();
    form.setFieldsValue({
      branchId: effectiveBranchId || defaultBranchId,
      gender: "male",
      dateOfJoining: dayjs(),
      country: "India",
      paidAmount: 0,
      paymentMethod: "cash" as const,
      emergencyContacts: []
    });
    setModalOpen(true);
  };

  const openEdit = async (record: Member) => {
    setEditing(record);
    setAvatarList([]);
    setLookupMember(null);
    setLookupNote("");
    setModalOpen(true);
    setSubmitting(true);
    try {
      const { data } = await apiClient.get<MemberResponse>(`/gym/members/${record._id}`);
      if (!data.success || !data.member) {
        message.error(data.message ?? "Could not load member.");
        setModalOpen(false);
        return;
      }
      const m = data.member;
      form.setFieldsValue({
        branchId: canManageBranches ? m.branchId : effectiveBranchId || m.branchId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email ?? undefined,
        phone: m.profile.phone,
        gender: m.profile.gender,
        dob: m.profile.dob ? dayjs(m.profile.dob) : undefined,
        street: m.address.street,
        city: m.address.city,
        state: m.address.state,
        zipcode: m.address.zipcode,
        country: m.address.country || "India",
        emergencyContacts: m.emergencyContacts?.length
          ? m.emergencyContacts
          : [{ name: "", phone: "", relation: "" }],
        notes: m.notes
      });
      if (m.profile.profilePicture) {
        setAvatarList([{ uid: "-1", name: "photo", status: "done", url: m.profile.profilePicture }]);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load member.");
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    setAvatarList([]);
    setLookupMember(null);
    setLookupNote("");
    setLookupLoading(false);
  };

  const lookupExistingMember = useCallback(
    async (phoneDigits: string, branchId: string) => {
      if (!phoneDigits || phoneDigits.length !== 10 || !branchId) {
        setLookupMember(null);
        setLookupNote("");
        return;
      }
      setLookupLoading(true);
      try {
        const { data } = await apiClient.get<MemberLookupResponse>("/gym/members/lookup", {
          params: { phone: phoneDigits, branchId }
        });
        if (data.success && data.found && data.member) {
          setLookupMember(data.member);
          setLookupNote("Existing member found for this branch. Subscription will be added to that member.");
        } else {
          setLookupMember(null);
          setLookupNote("No existing member found in this branch. A new member will be created.");
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "response" in e
            ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
            : undefined;
        setLookupMember(null);
        setLookupNote(msg ?? "Could not check existing member by mobile.");
      } finally {
        setLookupLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!modalOpen || Boolean(editing)) {
      return;
    }
    const phoneDigits = stripToIndianMobileDigits(watchedPhone ?? "");
    const scopedBranchId = String(watchedBranchId ?? "");
    if (phoneDigits.length !== 10 || !scopedBranchId) {
      setLookupMember(null);
      setLookupNote("");
      setLookupLoading(false);
      return;
    }
    const timer = globalThis.setTimeout(() => {
      void lookupExistingMember(phoneDigits, scopedBranchId);
    }, 350);
    return () => globalThis.clearTimeout(timer);
  }, [modalOpen, editing, watchedPhone, watchedBranchId, lookupExistingMember]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailMember(null);
  };

  const openView = async (record: Member) => {
    setDetailOpen(true);
    setDetailMember(null);
    try {
      const { data } = await apiClient.get<MemberResponse>(`/gym/members/${record._id}`);
      if (data.success && data.member) {
        setDetailMember(data.member);
      } else {
        message.error(data.message ?? "Could not load member.");
        setDetailOpen(false);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load member.");
      setDetailOpen(false);
    }
  };

  const handleDelete = async (record: Member) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(`/gym/members/${record._id}`);
      if (data.success) {
        message.success("Member deleted.");
        await loadMembers();
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

  const beforeUploadAvatar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setAvatarList([{ uid: String(Date.now()), name: file.name, status: "done", url: result }]);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const phoneDigits = stripToIndianMobileDigits(values.phone);
      if (phoneDigits.length !== 10) {
        message.error("Enter a valid 10-digit mobile number.");
        setSubmitting(false);
        return;
      }

      const profilePicture =
        avatarList[0]?.url && typeof avatarList[0].url === "string" ? avatarList[0].url : null;

      if (editing) {
        const payload = {
          firstName: values.firstName.trim(),
          lastName: (values.lastName ?? "").trim(),
          email: values.email?.trim() || null,
          profile: {
            phone: phoneDigits,
            gender: values.gender,
            dob: values.dob ? values.dob.toDate().toISOString() : null,
            profilePicture
          },
          address: {
            street: (values.street ?? "").trim(),
            city: (values.city ?? "").trim(),
            state: (values.state ?? "").trim(),
            zipcode: (values.zipcode ?? "").trim(),
            country: (values.country ?? "").trim() || "India"
          },
          emergencyContacts: (values.emergencyContacts ?? [])
            .map((c) => ({
              name: c.name.trim(),
              phone: stripToIndianMobileDigits(c.phone),
              relation: c.relation.trim()
            }))
            .filter((c) => c.name && c.phone && c.relation),
          notes: (values.notes ?? "").trim(),
          status: editing.status
        };

        const { data } = await apiClient.patch<MemberResponse>(`/gym/members/${editing._id}`, payload);
        if (data.success) {
          message.success("Member updated.");
          closeModal();
          await loadMembers();
        } else {
          message.error(data.message ?? "Update failed.");
        }
        return;
      }

      const ec = (values.emergencyContacts ?? [])
        .map((c) => ({
          name: (c.name ?? "").trim(),
          phone: stripToIndianMobileDigits(c.phone ?? ""),
          relation: (c.relation ?? "").trim()
        }))
        .filter((c) => c.name && c.phone && c.relation);

      if (!values.planId) {
        message.error("Select a membership plan.");
        setSubmitting(false);
        return;
      }

      const scopedBranchId = canManageBranches ? values.branchId : effectiveBranchId;
      if (!scopedBranchId) {
        message.error("Select a branch.");
        setSubmitting(false);
        return;
      }

      let existingMemberForSubmit: Member | null = null;
      try {
        const lookup = await apiClient.get<MemberLookupResponse>("/gym/members/lookup", {
          params: { phone: phoneDigits, branchId: scopedBranchId }
        });
        if (lookup.data.success && lookup.data.found && lookup.data.member) {
          existingMemberForSubmit = lookup.data.member;
          setLookupMember(lookup.data.member);
          setLookupNote("Existing member found for this branch. Subscription will be added to that member.");
        } else {
          setLookupMember(null);
          setLookupNote("No existing member found in this branch. A new member will be created.");
        }
      } catch {
        message.error("Could not verify existing member by mobile. Please try again.");
        setSubmitting(false);
        return;
      }

      const createPayload = {
        branchId: scopedBranchId,
        firstName: values.firstName.trim(),
        lastName: (values.lastName ?? "").trim(),
        email: values.email?.trim() || null,
        profile: {
          phone: phoneDigits,
          gender: values.gender,
          dob: values.dob ? values.dob.toDate().toISOString() : null,
          profilePicture
        },
        address: {
          street: (values.street ?? "").trim(),
          city: (values.city ?? "").trim(),
          state: (values.state ?? "").trim(),
          zipcode: (values.zipcode ?? "").trim(),
          country: (values.country ?? "").trim() || "India"
        },
        emergencyContacts: ec,
        notes: (values.notes ?? "").trim(),
        subscription: {
          planId: values.planId,
          startDate: values.dateOfJoining.toDate().toISOString(),
          paidAmount: values.paidAmount ?? 0,
          method: values.paymentMethod,
          transactionRef: null,
          autoRenew: false
        }
      };
      if (existingMemberForSubmit) {
        const patchPayload = {
          firstName: values.firstName.trim(),
          lastName: (values.lastName ?? "").trim(),
          email: values.email?.trim() || null,
          profile: {
            phone: phoneDigits,
            gender: values.gender,
            dob: values.dob ? values.dob.toDate().toISOString() : null,
            profilePicture
          },
          address: {
            street: (values.street ?? "").trim(),
            city: (values.city ?? "").trim(),
            state: (values.state ?? "").trim(),
            zipcode: (values.zipcode ?? "").trim(),
            country: (values.country ?? "").trim() || "India"
          },
          emergencyContacts: ec,
          notes: (values.notes ?? "").trim(),
          status: existingMemberForSubmit.status
        };
        const patchRes = await apiClient.patch<MemberResponse>(
          `/gym/members/${existingMemberForSubmit._id}`,
          patchPayload
        );
        if (!patchRes.data.success) {
          message.error(patchRes.data.message ?? "Could not update existing member details.");
          return;
        }

        const subRes = await apiClient.post<SubscriptionCreateResponse>(
          `/gym/members/${existingMemberForSubmit._id}/subscriptions`,
          {
            planId: values.planId,
            startDate: values.dateOfJoining.toDate().toISOString(),
            paidAmount: values.paidAmount ?? 0,
            method: values.paymentMethod,
            transactionRef: null,
            autoRenew: false
          }
        );
        if (subRes.data.success) {
          message.success("Existing member enrolled with a new subscription.");
          closeModal();
          await loadMembers();
        } else {
          message.error(subRes.data.message ?? "Could not add subscription for existing member.");
        }
        return;
      }

      const { data } = await apiClient.post<MemberResponse>("/gym/members", createPayload);
      if (data.success) {
        message.success("Member created.");
        closeModal();
        await loadMembers();
      } else {
        message.error(data.message ?? "Create failed.");
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

  const columns: ColumnsType<Member> = [
      {
        title: "Member",
        key: "member",
        ellipsis: true,
        render: (_, record) => (
          <Space>
            <Avatar src={record.profile.profilePicture || undefined}>
              {!record.profile.profilePicture
                ? `${record.firstName.charAt(0) || ""}${record.lastName.charAt(0) || ""}`.trim() || "?"
                : null}
            </Avatar>
            <span>
              {record.firstName} {record.lastName}
            </span>
          </Space>
        )
      },
      {
        title: "Status",
        key: "status",
        width: 100,
        render: (_, record) => (
          <Tag color={record.status === "active" ? "success" : "default"}>
            {record.status === "active" ? "ACTIVE" : "INACTIVE"}
          </Tag>
        )
      },
      {
        title: "Mobile Number",
        key: "phone",
        width: 160,
        render: (_, record) => (
          <Space size={6}>
            <PhoneOutlined style={{ color: token.colorTextSecondary }} />
            <span>+91{record.profile.phone}</span>
          </Space>
        )
      },
      {
        title: "Age",
        key: "age",
        width: 64,
        render: (_, record) => ageFromDob(record.profile.dob)
      },
      {
        title: "Membership",
        key: "plan",
        width: 180,
        ellipsis: true,
        render: (_, record) => {
          const sub = record.currentSubscription;
          if (!sub) {
            return "—";
          }
          return (
            <Space direction="vertical" size={0}>
              <Text>{sub.planName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatDisplayDate(sub.endDate)}
              </Text>
            </Space>
          );
        }
      },
      {
        title: "Billing",
        key: "billing",
        width: 140,
        render: (_, record) => billingCell(record, token)
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        fixed: "right",
        render: (_, record) => (
          <Space size={0}>
            <Tooltip title="View">
              <Button type="text" icon={<EyeOutlined />} onClick={() => void openView(record)} aria-label="View member" />
            </Tooltip>
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => void openEdit(record)}
                aria-label="Edit member"
                disabled={!canUpdateMember}
              />
            </Tooltip>
            <Popconfirm title="Delete this member?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => void handleDelete(record)}>
              <Tooltip title="Delete">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Delete member"
                  disabled={!canDeleteMember}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    ];

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
          Members
        </Title>
        <Space wrap>
          <Input
            allowClear
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Search name or mobile"
            style={{ width: 220 }}
          />
          <Select
            style={{ minWidth: 160 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: "all", label: "All members" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" }
            ]}
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220 }}
            placeholder="Branch"
            value={effectiveBranchId || undefined}
            onChange={(v) => setBranchFilter(v)}
            options={branchOptions}
            disabled={!canManageBranches}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadMembers()}>
            Refresh
          </Button>
          <ExportButton
            endpoint="/gym/exports/members"
            params={{
              branchId: effectiveBranchId || undefined,
              status: statusFilter !== "all" ? statusFilter : undefined,
              search: nameSearch.trim() || undefined
            }}
            defaultFilename="members.csv"
            disabled={!effectiveBranchId}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!canCreateMember}>
            Add member
          </Button>
        </Space>
      </div>

      <Table<Member>
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={displayedMembers}
        components={tableComponents}
        rowSelection={{ type: "checkbox" }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
        }}
        scroll={{ x: 1100 }}
        locale={{ emptyText: "No Data Found" }}
      />

      <Modal
        title="Member Details"
        open={detailOpen}
        onCancel={closeDetail}
        footer={[
          <Button key="close" type="primary" onClick={closeDetail}>
            Close
          </Button>
        ]}
        width={WIDE_MODAL_WIDTH}
      >
        {detailMember ? (
          <>
            <Space align="start" size={16} style={{ marginBottom: 16 }}>
              <Avatar size={64} src={detailMember.profile.profilePicture || undefined}>
                {!detailMember.profile.profilePicture
                  ? `${detailMember.firstName.charAt(0)}${detailMember.lastName.charAt(0)}`
                  : null}
              </Avatar>
              <div>
                <Title level={5} style={{ margin: 0 }}>
                  {detailMember.firstName} {detailMember.lastName}
                </Title>
                <Space size={8} style={{ marginTop: 8 }}>
                  <Tag color={detailMember.status === "active" ? "success" : "default"}>
                    {detailMember.status === "active" ? "ACTIVE" : "INACTIVE"}
                  </Tag>
                  {detailMember.flags?.hasPendingPayment ? <Tag color="warning">PENDING</Tag> : null}
                </Space>
              </div>
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Phone">+91{detailMember.profile.phone}</Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {detailMember.profile.dob ? formatDisplayDate(detailMember.profile.dob) : "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Age">{ageFromDob(detailMember.profile.dob)}</Descriptions.Item>
              <Descriptions.Item label="Last Visit">N/A</Descriptions.Item>
            </Descriptions>
            <Divider orientationMargin={8} />
            <Text strong>Membership</Text>
            <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
              <Descriptions.Item label="Membership Type">
                {detailMember.currentSubscription?.planName ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount (₹)">
                {detailMember.currentSubscription
                  ? formatInrWhole(detailMember.currentSubscription.payment.totalAmount)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {detailMember.currentSubscription ? formatDisplayDate(detailMember.currentSubscription.startDate) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {detailMember.currentSubscription ? formatDisplayDate(detailMember.currentSubscription.endDate) : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Paid Amount (₹)">
                {detailMember.currentSubscription
                  ? formatInrWhole(detailMember.currentSubscription.payment.paidAmount)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Outstanding Amount (₹)">
                <Text type="danger">
                  {detailMember.currentSubscription
                    ? formatInrWhole(detailMember.currentSubscription.payment.pendingAmount)
                    : "—"}
                </Text>
              </Descriptions.Item>
            </Descriptions>
            <Divider orientationMargin={8} />
            <Text strong>Personal details</Text>
            <Descriptions column={1} size="small" bordered style={{ marginTop: 8 }}>
              <Descriptions.Item label="Gender">{detailMember.profile.gender}</Descriptions.Item>
              <Descriptions.Item label="Address">
                {[detailMember.address.street, detailMember.address.city, detailMember.address.state, detailMember.address.zipcode]
                  .filter(Boolean)
                  .join(", ") || "N/A"}
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <div style={{ padding: 24, textAlign: "center" }}>
            <Text type="secondary">Loading…</Text>
          </div>
        )}
      </Modal>

      <Modal
        title={editing ? "Edit member" : "Add or enroll member"}
        open={modalOpen}
        onCancel={closeModal}
        width={WIDE_MODAL_WIDTH}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        footer={[
          <Button key="cancel" onClick={closeModal}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => void onSubmit()}>
            {editing ? "Save changes" : lookupMember ? "Enroll Existing Member" : "Create Member"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical" requiredMark style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: "Enter first name" }]}
              >
                <Input placeholder="Enter first name" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
              >
                <Input placeholder="Enter last name" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phone"
                label="Mobile number"
                rules={[
                  { required: true, message: "Enter mobile number" },
                  {
                    validator: async (_, v) => {
                      const d = stripToIndianMobileDigits(v);
                      if (d.length !== 10) {
                        throw new Error("Enter 10 digit mobile number");
                      }
                    }
                  }
                ]}
              >
                <Space.Compact style={{ width: "100%" }}>
                  <Input
                    readOnly
                    tabIndex={-1}
                    value="+91"
                    style={{
                      width: 56,
                      textAlign: "center",
                      background: token.colorFillAlter,
                      color: token.colorText
                    }}
                  />
                  <Input
                    placeholder="Enter 10 Digit Mobile Number"
                    maxLength={10}
                    style={{ width: "calc(100% - 56px)" }}
                  />
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="branchId"
                label="Branch"
                rules={[{ required: true, message: "Select branch" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select branch"
                  options={branchOptions}
                  disabled={Boolean(editing) || !canManageBranches}
                />
              </Form.Item>
            </Col>
          </Row>
          {!editing && lookupLoading ? (
            <Alert type="info" message="Checking existing member by mobile..." showIcon style={{ marginBottom: 16 }} />
          ) : null}
          {!editing && !lookupLoading && lookupNote ? (
            <Alert
              type={lookupMember ? "info" : "success"}
              message={lookupNote}
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form.Item
            label={
              <span>
                Profile photo{" "}
                <QuestionCircleOutlined title="Stored as data URL for now; keep images small." />
              </span>
            }
          >
            <Upload
              listType="picture-card"
              maxCount={1}
              fileList={avatarList}
              beforeUpload={beforeUploadAvatar}
              onRemove={() => setAvatarList([])}
            >
              {avatarList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                type: "email",
                message: "Invalid email"
              }
            ]}
          >
            <Input placeholder="user@gmail.com" allowClear />
          </Form.Item>

          <Divider plain>Personal details</Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[{ required: true, message: "Select gender" }]}
              >
                <Select
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="dob" label="Date of Birth">
                <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" placeholder="Select date of birth" />
              </Form.Item>
            </Col>
          </Row>

          {!editing && (
            <Form.Item
              name="dateOfJoining"
              label="Date of Joining"
              rules={[{ required: true, message: "Select date of joining" }]}
            >
              <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
            </Form.Item>
          )}

          <Divider plain>Address</Divider>

          <Form.Item name="street" label="Street Address">
            <Input prefix={<HomeOutlined />} placeholder="Enter street address" allowClear />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="City">
                <Input placeholder="City" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="state" label="State">
                <Input placeholder="State" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="zipcode" label="Zipcode">
                <Input placeholder="Enter zipcode" allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="country" label="Country">
                <Input placeholder="Country" allowClear />
              </Form.Item>
            </Col>
          </Row>

          {!editing && (
            <>
              <Divider plain>Plan &amp; payment</Divider>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="planId"
                    label="Membership plan"
                    rules={[{ required: true, message: "Select a plan" }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder={planOptions.length ? "Select plan" : "No active plans found"}
                      options={planOptions}
                      onOpenChange={(open) => {
                        if (open) {
                          reloadPlansForOpenDropdown();
                        }
                      }}
                      notFoundContent={
                        planOptions.length ? undefined : (
                          <Text type="secondary">Create a plan under the Memberships tab.</Text>
                        )
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="paidAmount" label="Paid amount">
                    <InputNumber min={0} step={100} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="paymentMethod" label="Payment method">
                <Select
                  options={[
                    { value: "cash", label: "Cash" },
                    { value: "upi", label: "UPI" },
                    { value: "card", label: "Card" }
                  ]}
                />
              </Form.Item>
            </>
          )}

          <Divider plain>Emergency contacts</Divider>

          <Form.List name="emergencyContacts">
            {(fields, { add, remove }) => (
              <div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row gutter={8} key={key} style={{ marginBottom: 8 }} wrap={false}>
                    <Col flex="1 1 120px">
                      <Form.Item
                        {...restField}
                        name={[name, "name"]}
                        rules={[{ required: true, message: "Name" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Name" />
                      </Form.Item>
                    </Col>
                    <Col flex="1 1 120px">
                      <Form.Item
                        {...restField}
                        name={[name, "phone"]}
                        rules={[
                          { required: true, message: "Phone" },
                          {
                            validator: async (_, v) => {
                              const d = stripToIndianMobileDigits(v);
                              if (d.length !== 10) {
                                throw new Error("10 digits");
                              }
                            }
                          }
                        ]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Phone" />
                      </Form.Item>
                    </Col>
                    <Col flex="1 1 100px">
                      <Form.Item
                        {...restField}
                        name={[name, "relation"]}
                        rules={[{ required: true, message: "Relation" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Relation" />
                      </Form.Item>
                    </Col>
                    <Col flex="none">
                      <Button type="text" danger onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ name: "", phone: "", relation: "" })}>
                  Add Contact
                </Button>
              </div>
            )}
          </Form.List>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Notes (e.g. health)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
