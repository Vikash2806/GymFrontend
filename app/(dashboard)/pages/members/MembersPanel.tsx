"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  App,
  Avatar,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Upload,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  CloseCircleOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  EditOutlined,
  EyeOutlined,
  HomeOutlined,
  InboxOutlined,
  PhoneOutlined,
  PlusOutlined,
  WalletOutlined
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import apiClient from "@/utils/api";
import type { Member } from "@/types/member";
import type { MembershipPlan } from "@/types/membership";
import type { GymUsageSnapshotResponse } from "@/types/usage";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { stripToIndianMobileDigits } from "@/utils/mobileValidation";
import { formatInrWhole } from "@/utils/formatCurrency";
import { stripPlanNamePriceSuffix } from "@/utils/planDisplayName";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { getCityOptions, getCountryOptions, getStateOptions } from "@/utils/options";
import { calculateMembershipPaymentSummary, computeMembershipMoneyLines } from "@/utils/membershipPaymentSummary";
import ExportButton from "@/app/components/Export/ExportButton";
import OverduePaymentModal from "@/app/components/payments/OverduePaymentModal";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";
import MemberDetailsModal from "./MemberDetailsModal";

const { Title, Text } = Typography;
const DEFAULT_COUNTRY_CODE = "IN";
const DEFAULT_STATE_CODE = "TN";
const DEFAULT_CITY_CODE = "TN_TNJ";
const PAYMENT_CAP_MESSAGE = "Paid amount cannot be greater than the final payable amount.";

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<Member>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

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

function formatDisplayDate(iso: string | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = dayjs(iso);
  return d.isValid() ? d.format("DD-MM-YYYY") : "—";
}

function mapMemberFieldLabel(path: Array<string | number>): string {
  const normalized = path.map((part) => String(part));
  const root = normalized[0] ?? "";
  if (root === "emergencyContacts") {
    const leaf = normalized[2] ?? "";
    if (leaf === "name") {
      return "Emergency contact name";
    }
    if (leaf === "phone") {
      return "Emergency contact phone";
    }
    if (leaf === "relation") {
      return "Emergency contact relation";
    }
    return "Emergency contact";
  }
  const directMap: Record<string, string> = {
    firstName: "First Name",
    lastName: "Last Name",
    phone: "Mobile number",
    branchId: "Branch",
    email: "Email",
    gender: "Gender",
    dob: "Date of Birth",
    dateOfJoining: "Date of Joining",
    street: "Street Address",
    city: "City",
    state: "State",
    zipcode: "Zipcode",
    country: "Country",
    planId: "Membership plan",
    miscFeeAmount: "Misc fees",
    personalTrainerFeeAmount: "Personal trainer fee",
    discountAmount: "Discount (off subtotal)",
    paidAmount: "Paid amount",
    paymentMethod: "Payment method",
    notes: "Notes"
  };
  return directMap[root] ?? root;
}

type ListResponse = {
  success: boolean;
  members?: Member[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

type MemberResponse = { success: boolean; member?: Member; message?: string };
type PlansResponse = { success: boolean; plans?: MembershipPlan[]; message?: string };
type MemberLookupResponse = {
  success: boolean;
  found?: boolean;
  member?: Member | null;
  message?: string;
};
type SubscriptionCreateResponse = { success: boolean; message?: string };
type SubscriptionPatchResponse = { success: boolean; message?: string };
type ImportMembersResponse = {
  success: boolean;
  message?: string;
  totalRows?: number;
  successCount?: number;
  failedCount?: number;
  failures?: Array<{ row: number; message: string }>;
};
type MemberTableColumnKey =
  | "member"
  | "status"
  | "phone"
  | "age"
  | "plan"
  | "totalPending"
  | "actions";

type MemberListFilter = "all" | "active" | "inactive" | "overdue";

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

function displayMemberAge(m: Member): string {
  if (m.profile.dob) {
    return ageFromDob(m.profile.dob);
  }
  const y = m.profile.ageYears;
  if (y !== undefined && y !== null && Number.isFinite(Number(y))) {
    return String(y);
  }
  return "—";
}

function moneyEqualsCents(a: unknown, b: unknown): boolean {
  return Math.round((Number(a) || 0) * 100) === Math.round((Number(b) || 0) * 100);
}

/** Coerce Form / InputNumber watch values to finite rupees (avoids string quirks in money math). */
function watchMoney(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n * 100) / 100;
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
  miscFeesEnabled: boolean;
  miscFeeAmount?: number;
  personalTrainerEnabled: boolean;
  personalTrainerFeeAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  paymentMethod: "cash" | "upi" | "card";
  emergencyContacts: Array<{ name: string; phone: string; relation: string }>;
  notes?: string;
};

function cloneMemberDraft(draft?: Partial<FormShape> | null): Partial<FormShape> {
  if (!draft) {
    return {};
  }
  return {
    ...draft,
    dob: draft.dob ? dayjs(draft.dob) : draft.dob ?? undefined,
    dateOfJoining: draft.dateOfJoining ? dayjs(draft.dateOfJoining) : undefined,
    emergencyContacts: Array.isArray(draft.emergencyContacts)
      ? draft.emergencyContacts.map((contact) => ({
          name: contact?.name ?? "",
          phone: contact?.phone ?? "",
          relation: contact?.relation ?? ""
        }))
      : undefined
  };
}

export type MembersPanelProps = {
  onMemberCountChange?: (count: number) => void;
  onRequestCreateMembershipPlan?: (draft?: Partial<FormShape>) => void;
  createdPlanFromMemberships?: { _id: string; name: string } | null;
  memberDraftFromMemberships?: Partial<FormShape> | null;
  onMemberDraftHandled?: () => void;
  onCreatedPlanHandled?: () => void;
};

export default function MembersPanel({
  onMemberCountChange,
  onRequestCreateMembershipPlan,
  createdPlanFromMemberships,
  memberDraftFromMemberships,
  onMemberDraftHandled,
  onCreatedPlanHandled
}: MembersPanelProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const canManageBranches = hasFeature(session, FEATURES.BRANCH_MANAGEMENT);
  const canCreateMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const canUpdateMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const canDeleteMember = hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
  const canRecordBillingPayment = hasFeature(session, FEATURES.BILLING_DASHBOARD);
  const assignedBranchId = session?.user?.defaults?.branchId ?? "";
  const defaultBranchId = canManageBranches
    ? session?.activeBranch?.id ?? assignedBranchId
    : assignedBranchId || session?.activeBranch?.id || "";

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [memberListFilter, setMemberListFilter] = useState<MemberListFilter>(() =>
    searchParams.get("filter") === "overdue" ? "overdue" : "all"
  );
  const [nameSearch, setNameSearch] = useState("");
  const [debouncedNameSearch, setDebouncedNameSearch] = useState("");
  const [membersPage, setMembersPage] = useState(1);
  const [membersPageSize, setMembersPageSize] = useState(10);
  const [membersTotal, setMembersTotal] = useState(0);
  const effectiveBranchId = defaultBranchId;

  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [overduePayMember, setOverduePayMember] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalDirty, setModalDirty] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMember, setLookupMember] = useState<Member | null>(null);
  const [lookupNote, setLookupNote] = useState<string>("");
  const [newMembershipTarget, setNewMembershipTarget] = useState<Member | null>(null);
  const [pendingCreatedPlan, setPendingCreatedPlan] = useState<{ _id: string; name: string } | null>(null);
  const [memberLimitReached, setMemberLimitReached] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Member | null>(null);
  const [cancelRefundAmount, setCancelRefundAmount] = useState<number | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [importSummary, setImportSummary] = useState<ImportMembersResponse | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<MemberTableColumnKey[]>([
    "member",
    "status",
    "phone",
    "age",
    "plan",
    "totalPending",
    "actions"
  ]);
  const planRequestSeq = useRef(0);
  const skipNextUrlDrivenFilterSyncRef = useRef(false);
  /** Last final payable used for auto-filled paid amount; null until first Plan & payment sync in this modal session. */
  const prevFinalPayableForPaidSyncRef = useRef<number | null>(null);
  const [form] = Form.useForm<FormShape>();
  const watchedPhone = Form.useWatch("phone", form);
  const watchedBranchId = Form.useWatch("branchId", form);
  const watchedCountry = Form.useWatch("country", form);
  const watchedState = Form.useWatch("state", form);
  const watchedPlanId = Form.useWatch("planId", form);
  const watchedMiscFeesEnabled = Form.useWatch("miscFeesEnabled", form);
  const watchedMiscFeeAmount = Form.useWatch("miscFeeAmount", form);
  const watchedPersonalTrainerEnabled = Form.useWatch("personalTrainerEnabled", form);
  const watchedPersonalTrainerFeeAmount = Form.useWatch("personalTrainerFeeAmount", form);
  const watchedDiscountAmount = Form.useWatch("discountAmount", form);
  const watchedPaidAmount = Form.useWatch("paidAmount", form);
  const isAssigningNewMembership = Boolean(newMembershipTarget);
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();
  const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;
  const { Dragger } = Upload;

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
      setMembersTotal(0);
      setMembersPage(1);
      onMemberCountChange?.(0);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = { branchId: effectiveBranchId };
      if (memberListFilter === "overdue") {
        params.pendingPayment = "true";
      } else if (memberListFilter !== "all") {
        params.status = memberListFilter;
      }
      params.page = String(membersPage);
      params.pageSize = String(membersPageSize);
      if (debouncedNameSearch) {
        params.search = debouncedNameSearch;
      }
      const { data } = await apiClient.get<ListResponse>("/gym/members", { params });
      if (data.success && Array.isArray(data.members)) {
        setMembers(data.members);
        const total = typeof data.total === "number" ? data.total : data.members.length;
        setMembersTotal(total);
        onMemberCountChange?.(total);
      } else {
        setMembers([]);
        setMembersTotal(0);
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
      setMembersTotal(0);
      onMemberCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, memberListFilter, membersPage, membersPageSize, debouncedNameSearch, onMemberCountChange, message]);

  const loadMemberUsage = useCallback(async () => {
    if (!effectiveBranchId) {
      setMemberLimitReached(false);
      return;
    }
    try {
      const { data } = await apiClient.get<GymUsageSnapshotResponse>("/gym/usage/check");
      setMemberLimitReached(Boolean(data.limitsReached?.members));
    } catch {
      setMemberLimitReached(false);
    }
  }, [effectiveBranchId]);

  const planBranchId = useMemo(() => {
    if (editing) {
      return "";
    }
    if (typeof watchedBranchId === "string" && watchedBranchId) {
      return watchedBranchId;
    }
    return effectiveBranchId || defaultBranchId || "";
  }, [editing, watchedBranchId, effectiveBranchId, defaultBranchId]);
  const selectedPlanPrice = useMemo(() => {
    if (!watchedPlanId) {
      return null;
    }
    const selectedPlan = plans.find((plan) => plan._id === watchedPlanId);
    return selectedPlan ? Number(selectedPlan.price ?? 0) : null;
  }, [plans, watchedPlanId]);
  const paymentPreview = useMemo(
    () =>
      calculateMembershipPaymentSummary({
        planPrice: selectedPlanPrice ?? 0,
        miscFeesEnabled: Boolean(watchedMiscFeesEnabled),
        miscFeeAmount: watchMoney(watchedMiscFeeAmount),
        personalTrainerEnabled: Boolean(watchedPersonalTrainerEnabled),
        personalTrainerFeeAmount: watchMoney(watchedPersonalTrainerFeeAmount),
        discountAmount: watchMoney(watchedDiscountAmount),
        paidAmount: watchMoney(watchedPaidAmount)
      }),
    [
      selectedPlanPrice,
      watchedMiscFeesEnabled,
      watchedMiscFeeAmount,
      watchedPersonalTrainerEnabled,
      watchedPersonalTrainerFeeAmount,
      watchedDiscountAmount,
      watchedPaidAmount
    ]
  );

  const finalPayableForPaidSync = useMemo(
    () =>
      computeMembershipMoneyLines({
        planPrice: selectedPlanPrice ?? 0,
        miscFeesEnabled: Boolean(watchedMiscFeesEnabled),
        miscFeeAmount: watchMoney(watchedMiscFeeAmount),
        personalTrainerEnabled: Boolean(watchedPersonalTrainerEnabled),
        personalTrainerFeeAmount: watchMoney(watchedPersonalTrainerFeeAmount),
        discountAmount: watchMoney(watchedDiscountAmount),
        paidAmount: 0
      }).finalPayableAmount,
    [
      selectedPlanPrice,
      watchedMiscFeesEnabled,
      watchedMiscFeeAmount,
      watchedPersonalTrainerEnabled,
      watchedPersonalTrainerFeeAmount,
      watchedDiscountAmount
    ]
  );

  useEffect(() => {
    if (!modalOpen || editing) {
      return;
    }
    const nextFinal = finalPayableForPaidSync;
    const paidRaw = form.getFieldValue("paidAmount");
    const prevFinal = prevFinalPayableForPaidSyncRef.current;
    const alignedWithSuggestion =
      prevFinal === null
        ? moneyEqualsCents(paidRaw, 0) || moneyEqualsCents(paidRaw, nextFinal)
        : moneyEqualsCents(paidRaw, prevFinal);
    if (alignedWithSuggestion && !moneyEqualsCents(paidRaw, nextFinal)) {
      form.setFieldsValue({ paidAmount: nextFinal });
    }
    prevFinalPayableForPaidSyncRef.current = nextFinal;
  }, [modalOpen, editing, finalPayableForPaidSync, form]);

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
    void loadMemberUsage();
  }, [loadMemberUsage]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedNameSearch(nameSearch.trim().toLowerCase());
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [nameSearch]);

  useEffect(() => {
    setMembersPage(1);
  }, [effectiveBranchId, memberListFilter, debouncedNameSearch]);

  useLayoutEffect(() => {
    if (skipNextUrlDrivenFilterSyncRef.current) {
      skipNextUrlDrivenFilterSyncRef.current = false;
      return;
    }
    if (searchParams.get("filter") === "overdue") {
      setMemberListFilter("overdue");
    }
  }, [searchParams]);

  const syncMemberListFilterToUrl = useCallback(
    (next: MemberListFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overdue") {
        params.set("filter", "overdue");
      } else {
        params.delete("filter");
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onMemberListFilterChange = useCallback(
    (next: MemberListFilter) => {
      skipNextUrlDrivenFilterSyncRef.current = true;
      setMemberListFilter(next);
      syncMemberListFilterToUrl(next);
    },
    [syncMemberListFilterToUrl]
  );

  const branchOptions = useMemo(() => {
    const br = session?.gym?.branches ?? [];
    const activeBranches = br.filter((branch) => {
      const branchStatus = (branch as { status?: string }).status;
      return !branchStatus || branchStatus === "active";
    });
    const visibleBranches = canManageBranches
      ? activeBranches
      : activeBranches.filter((branch) => branch.id === defaultBranchId);
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
  const countryOptions = useMemo(() => getCountryOptions("en", "code"), []);
  const sectionTitleStyle: React.CSSProperties = { marginBottom: 12 };
  const sectionCardStyle: React.CSSProperties = {
    backgroundColor: token.colorBgBase,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16
  };
  const paymentSummaryRowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center"
  };
  const paymentSummaryValueStyle: React.CSSProperties = {
    minWidth: 96,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums"
  };
  const selectedCountryCode = (watchedCountry as string | undefined) ?? DEFAULT_COUNTRY_CODE;
  const stateOptions = useMemo(
    () => getStateOptions("en", selectedCountryCode, "code"),
    [selectedCountryCode]
  );
  const selectedStateCode = (watchedState as string | undefined) ?? DEFAULT_STATE_CODE;
  const cityOptions = useMemo(
    () => getCityOptions("en", selectedStateCode, selectedCountryCode, "code"),
    [selectedStateCode, selectedCountryCode]
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

  const openCreate = useCallback((draft?: Partial<FormShape>) => {
    setEditing(null);
    setNewMembershipTarget(null);
    setLookupMember(null);
    setLookupNote("");
    form.resetFields();
    prevFinalPayableForPaidSyncRef.current = null;
    form.setFieldsValue({
      branchId: effectiveBranchId || defaultBranchId,
      gender: "male",
      dateOfJoining: dayjs(),
      state: DEFAULT_STATE_CODE,
      city: DEFAULT_CITY_CODE,
      country: DEFAULT_COUNTRY_CODE,
      miscFeesEnabled: false,
      miscFeeAmount: 0,
      personalTrainerEnabled: false,
      personalTrainerFeeAmount: 0,
      discountAmount: 0,
      paidAmount: 0,
      paymentMethod: "cash" as const,
      emergencyContacts: []
    });
    if (draft) {
      form.setFieldsValue(cloneMemberDraft(draft));
    }
    setModalDirty(false);
    clearDirty("members-modal");
    setModalOpen(true);
  }, [clearDirty, defaultBranchId, effectiveBranchId, form]);

  const startCreateMembershipFromMemberModal = () => {
    const rawDraft = form.getFieldsValue(true) as Partial<FormShape>;
    const draft = cloneMemberDraft(rawDraft);
    setModalOpen(false);
    onRequestCreateMembershipPlan?.(draft);
  };

  const openEdit = useCallback(async (record: Member) => {
    setEditing(record);
    setNewMembershipTarget(null);
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
        city: toOptionValue(cityOptions, m.address.city, DEFAULT_CITY_CODE),
        state: toOptionValue(stateOptions, m.address.state, DEFAULT_STATE_CODE),
        zipcode: m.address.zipcode,
        country: toOptionValue(countryOptions, m.address.country, DEFAULT_COUNTRY_CODE),
        emergencyContacts: m.emergencyContacts?.length
          ? m.emergencyContacts
          : [{ name: "", phone: "", relation: "" }],
        notes: m.notes
      });
      setModalDirty(false);
      clearDirty("members-modal");
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
  }, [message, form, canManageBranches, effectiveBranchId, cityOptions, stateOptions, countryOptions, clearDirty]);

  useEffect(() => {
    if (!memberDraftFromMemberships || createdPlanFromMemberships) {
      return;
    }
    openCreate(memberDraftFromMemberships);
    onMemberDraftHandled?.();
  }, [memberDraftFromMemberships, createdPlanFromMemberships, onMemberDraftHandled, openCreate]);

  useEffect(() => {
    if (!createdPlanFromMemberships) {
      return;
    }
    setPendingCreatedPlan(createdPlanFromMemberships);
    const branchFromDraft = String(memberDraftFromMemberships?.branchId ?? effectiveBranchId ?? defaultBranchId ?? "");
    openCreate(memberDraftFromMemberships ?? undefined);
    if (branchFromDraft) {
      void loadPlans(branchFromDraft);
    }
  }, [createdPlanFromMemberships, memberDraftFromMemberships, effectiveBranchId, defaultBranchId, openCreate, loadPlans]);

  useEffect(() => {
    if (!pendingCreatedPlan) {
      return;
    }
    const matchedPlan = plans.find((plan) => plan._id === pendingCreatedPlan._id);
    if (!matchedPlan) {
      return;
    }
    const createdPlanFinal = computeMembershipMoneyLines({
      planPrice: Number(matchedPlan.price ?? 0),
      miscFeesEnabled: Boolean(form.getFieldValue("miscFeesEnabled")),
      miscFeeAmount: watchMoney(form.getFieldValue("miscFeeAmount")),
      personalTrainerEnabled: Boolean(form.getFieldValue("personalTrainerEnabled")),
      personalTrainerFeeAmount: watchMoney(form.getFieldValue("personalTrainerFeeAmount")),
      discountAmount: watchMoney(form.getFieldValue("discountAmount")),
      paidAmount: 0
    }).finalPayableAmount;
    form.setFieldsValue({
      planId: matchedPlan._id,
      paidAmount: createdPlanFinal
    });
    prevFinalPayableForPaidSyncRef.current = createdPlanFinal;
    setPendingCreatedPlan(null);
    onCreatedPlanHandled?.();
    onMemberDraftHandled?.();
  }, [pendingCreatedPlan, plans, form, onCreatedPlanHandled, onMemberDraftHandled]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setNewMembershipTarget(null);
    prevFinalPayableForPaidSyncRef.current = null;
    form.resetFields();
    setLookupMember(null);
    setLookupNote("");
    setLookupLoading(false);
    setModalDirty(false);
    clearDirty("members-modal");
  }, [form, clearDirty]);

  const requestCloseModal = useCallback(() => {
    if (modalDirty) {
      confirmNavigation(() => {
        closeModal();
      });
      return;
    }
    closeModal();
  }, [modalDirty, confirmNavigation, closeModal]);

  const openNewMembership = useCallback((record: Member) => {
    setEditing(null);
    setNewMembershipTarget(record);
    setLookupLoading(false);
    setLookupMember(record);
    setLookupNote(`Assigning new membership for ${record.firstName} ${record.lastName}.`);
    void loadPlans(record.branchId);
    form.resetFields();
    prevFinalPayableForPaidSyncRef.current = null;
    form.setFieldsValue({
      planId: undefined,
      miscFeesEnabled: false,
      miscFeeAmount: 0,
      personalTrainerEnabled: false,
      personalTrainerFeeAmount: 0,
      discountAmount: 0,
      paidAmount: 0,
      paymentMethod: "cash" as const
    });
    setModalDirty(false);
    clearDirty("members-modal");
    setModalOpen(true);
  }, [clearDirty, form, loadPlans]);

  const openCancelMembershipModal = (record: Member) => {
    setCancelTarget(record);
    setCancelRefundAmount(null);
  };

  const closeCancelMembershipModal = () => {
    if (cancelSubmitting) {
      return;
    }
    setCancelTarget(null);
    setCancelRefundAmount(null);
  };

  const handleCancelMembership = async (record: Member, refundAmount: number) => {
    const subscriptionId = record.currentSubscription?.subscriptionId;
    if (!subscriptionId) {
      message.error("No current membership found.");
      return;
    }
    try {
      setCancelSubmitting(true);
      const { data } = await apiClient.patch<SubscriptionPatchResponse>(
        `/gym/members/${record._id}/subscriptions/${subscriptionId}`,
        { status: "cancelled", reverseOverdue: true, refundAmount }
      );
      if (data.success) {
        message.success("Membership cancelled and refund processed.");
        closeCancelMembershipModal();
        await loadMembers();
      } else {
        message.error(data.message ?? "Could not cancel membership.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not cancel membership.");
    } finally {
      setCancelSubmitting(false);
    }
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
    if (!modalOpen || Boolean(editing) || Boolean(newMembershipTarget)) {
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
  }, [modalOpen, editing, newMembershipTarget, watchedPhone, watchedBranchId, lookupExistingMember]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailMember(null);
  };

  const openView = useCallback(async (record: Member) => {
    setDetailOpen(true);
    setDetailMember(null);
    try {
      const memberRes = await apiClient.get<MemberResponse>(`/gym/members/${record._id}`);
      if (memberRes.data.success && memberRes.data.member) {
        setDetailMember(memberRes.data.member);
      } else {
        message.error(memberRes.data.message ?? "Could not load member.");
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
  }, [message]);

  const handleDelete = useCallback(async (record: Member) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(`/gym/members/${record._id}`);
      if (data.success) {
        message.success("Member deleted.");
        await loadMembers();
        await loadMemberUsage();
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
  }, [message, loadMembers, loadMemberUsage]);

  const openImportModal = useCallback(() => {
    setImportOpen(true);
    setImportSummary(null);
    setImportFileList([]);
  }, []);

  const submitMemberImport = useCallback(async () => {
    const selected = importFileList[0];
    if (!selected || !("originFileObj" in selected) || !selected.originFileObj) {
      message.error("Please select an Excel file.");
      return;
    }
    if (!effectiveBranchId) {
      message.error("Select an active branch before importing.");
      return;
    }
    const formData = new FormData();
    formData.append("file", selected.originFileObj);
    formData.append("branchId", effectiveBranchId);
    setImportSubmitting(true);
    try {
      const { data } = await apiClient.post<ImportMembersResponse>("/gym/members/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (data.success) {
        setImportSummary(data);
        await loadMembers();
        message.success(
          `Import completed. ${data.successCount ?? 0} success, ${data.failedCount ?? 0} failed.`
        );
      } else {
        message.error(data.message ?? "Import failed.");
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not import members.");
    } finally {
      setImportSubmitting(false);
    }
  }, [importFileList, effectiveBranchId, message, loadMembers]);

  const getRowActionItems = useCallback(
    (record: Member) => {
      const menuItemStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.35, minHeight: 40, paddingBlock: 10 };
      const totalPending = record.financialSummary?.lifetime?.totalPending ?? 0;
      const newMembershipDisabled =
        !canCreateMember || record.currentSubscription?.status === "active";
      const overdueItem =
        canRecordBillingPayment && totalPending > 0
          ? [
              {
                key: "overdue",
                label: "Add overdue payment",
                icon: <WalletOutlined />,
                style: menuItemStyle,
                onClick: () => {
                  setOverduePayMember(record);
                }
              }
            ]
          : [];
      return [
        {
          key: "newMembership",
          label: "New membership",
          icon: <PlusOutlined />,
          style: menuItemStyle,
          disabled: newMembershipDisabled,
          onClick: () => {
            if (!newMembershipDisabled) {
              openNewMembership(record);
            }
          }
        },
        {
          key: "view",
          label: "View Details",
          icon: <EyeOutlined />,
          style: menuItemStyle,
          onClick: () => {
            void openView(record);
          }
        },
        ...overdueItem,
        {
          key: "edit",
          label: "Edit",
          icon: <EditOutlined />,
          style: menuItemStyle,
          disabled: !canUpdateMember,
          onClick: () => {
            void openEdit(record);
          }
        },
        {
          key: "cancel",
          label: "Cancel Membership",
          icon: <CloseCircleOutlined />,
          style: menuItemStyle,
          danger: true,
          disabled: !record.currentSubscription,
          onClick: () => {
            openCancelMembershipModal(record);
          }
        },
        {
          key: "delete",
          label: "Delete",
          icon: <DeleteOutlined />,
          style: menuItemStyle,
          danger: true,
          disabled: !canDeleteMember,
          onClick: () => {
            modal.confirm({
              title: "Delete this member?",
              okText: "Delete",
              okButtonProps: { danger: true },
              onOk: async () => {
                await handleDelete(record);
              }
            });
          }
        }
      ];
    },
    [canCreateMember, canRecordBillingPayment, canUpdateMember, canDeleteMember, modal, openView, openNewMembership, openEdit, handleDelete]
  );

  const onSubmit = async () => {
    try {
      if (newMembershipTarget) {
        const membershipValues = await form.validateFields([
          "planId",
          "miscFeesEnabled",
          "miscFeeAmount",
          "personalTrainerEnabled",
          "personalTrainerFeeAmount",
          "discountAmount",
          "paidAmount",
          "paymentMethod"
        ]);
        if (!membershipValues.planId) {
          message.error("Select a membership plan.");
          return;
        }
        const selectedPlan = plans.find((plan) => plan._id === membershipValues.planId);
        const paymentSummary = calculateMembershipPaymentSummary({
          planPrice: Number(selectedPlan?.price ?? 0),
          miscFeesEnabled: Boolean(membershipValues.miscFeesEnabled),
          miscFeeAmount: membershipValues.miscFeeAmount,
          personalTrainerEnabled: Boolean(membershipValues.personalTrainerEnabled),
          personalTrainerFeeAmount: membershipValues.personalTrainerFeeAmount,
          discountAmount: membershipValues.discountAmount,
          paidAmount: membershipValues.paidAmount
        });
        if (Number(membershipValues.paidAmount ?? 0) > paymentSummary.finalPayableAmount) {
          form.setFieldsValue({ paidAmount: paymentSummary.finalPayableAmount });
          message.warning(PAYMENT_CAP_MESSAGE);
        }
        setSubmitting(true);
        const subRes = await apiClient.post<SubscriptionCreateResponse>(
          `/gym/members/${newMembershipTarget._id}/subscriptions`,
          {
            planId: membershipValues.planId,
            startDate: new Date().toISOString(),
            miscFeeAmount: paymentSummary.miscFeeAmount,
            personalTrainerFeeAmount: paymentSummary.personalTrainerFeeAmount,
            discountAmount: paymentSummary.discountAmount,
            paidAmount: paymentSummary.paidAmount,
            method: membershipValues.paymentMethod ?? "cash",
            transactionRef: null,
            autoRenew: false
          }
        );
        if (subRes.data.success) {
          message.success("New membership assigned.");
          closeModal();
          await loadMembers();
        } else {
          message.error(subRes.data.message ?? "Could not assign membership.");
        }
        return;
      }

      const values = await form.validateFields();
      setSubmitting(true);

      const phoneDigits = stripToIndianMobileDigits(values.phone);
      if (phoneDigits.length !== 10) {
        message.error("Enter a valid 10-digit mobile number.");
        setSubmitting(false);
        return;
      }

      const profilePicture = editing?.profile.profilePicture ?? null;

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
            country: (values.country ?? "").trim() || DEFAULT_COUNTRY_CODE
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
          setModalOpen(false);
          setEditing(null);
          setModalDirty(false);
          clearDirty("members-modal");
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
      const selectedPlan = plans.find((plan) => plan._id === values.planId);
      const paymentSummary = calculateMembershipPaymentSummary({
        planPrice: Number(selectedPlan?.price ?? 0),
        miscFeesEnabled: Boolean(values.miscFeesEnabled),
        miscFeeAmount: values.miscFeeAmount,
        personalTrainerEnabled: Boolean(values.personalTrainerEnabled),
        personalTrainerFeeAmount: values.personalTrainerFeeAmount,
        discountAmount: values.discountAmount,
        paidAmount: values.paidAmount
      });
      if (Number(values.paidAmount ?? 0) > paymentSummary.finalPayableAmount) {
        form.setFieldsValue({ paidAmount: paymentSummary.finalPayableAmount });
        message.warning(PAYMENT_CAP_MESSAGE);
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
          country: (values.country ?? "").trim() || DEFAULT_COUNTRY_CODE
        },
        emergencyContacts: ec,
        notes: (values.notes ?? "").trim(),
        subscription: {
          planId: values.planId,
          startDate: values.dateOfJoining.toDate().toISOString(),
          miscFeeAmount: paymentSummary.miscFeeAmount,
          personalTrainerFeeAmount: paymentSummary.personalTrainerFeeAmount,
          discountAmount: paymentSummary.discountAmount,
          paidAmount: paymentSummary.paidAmount,
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
            country: (values.country ?? "").trim() || DEFAULT_COUNTRY_CODE
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
            miscFeeAmount: paymentSummary.miscFeeAmount,
            personalTrainerFeeAmount: paymentSummary.personalTrainerFeeAmount,
            discountAmount: paymentSummary.discountAmount,
            paidAmount: paymentSummary.paidAmount,
            method: values.paymentMethod,
            transactionRef: null,
            autoRenew: false
          }
        );
        if (subRes.data.success) {
          message.success("Existing member enrolled with a new subscription.");
          setModalOpen(false);
          setEditing(null);
          setModalDirty(false);
          clearDirty("members-modal");
          await loadMembers();
        } else {
          message.error(subRes.data.message ?? "Could not add subscription for existing member.");
        }
        return;
      }

      const { data } = await apiClient.post<MemberResponse>("/gym/members", createPayload);
      if (data.success) {
        message.success("Member created.");
        setModalOpen(false);
        setEditing(null);
        setModalDirty(false);
        clearDirty("members-modal");
        await loadMembers();
        await loadMemberUsage();
      } else {
        message.error(data.message ?? "Create failed.");
      }
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) {
        const fields = (e as { errorFields?: Array<{ name?: Array<string | number> }> }).errorFields ?? [];
        const labels = Array.from(
          new Set(
            fields
              .map((field) => mapMemberFieldLabel(field.name ?? []))
              .filter((label) => Boolean(label))
          )
        );
        if (labels.length > 0) {
          message.error(`Please enter the required field(s): ${labels.join(", ")}`);
        }
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

  const columns: ColumnsType<Member> = useMemo(() => [
      {
        title: "Member",
        key: "member",
        width: 180,
        ellipsis: true,
        render: (_, record) => (
          <Space>
            <Avatar src={record.profile.profilePicture || undefined}>
              {!record.profile.profilePicture
                ? `${record.firstName.charAt(0) || ""}${record.lastName.charAt(0) || ""}`.trim() || "?"
                : null}
            </Avatar>
            <Button
              type="link"
              onClick={() => void openView(record)}
              style={{ padding: 0, height: "auto", textDecoration: "none" }}
            >
              {record.firstName} {record.lastName}
            </Button>
          </Space>
        )
      },
      {
        title: "Membership Status",
        key: "status",
        width: 100,
        render: (_, record) => (
          <Tag color={record.status === "active" ? "success" : "error"}>
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
        render: (_, record) => displayMemberAge(record)
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
              <Text>{stripPlanNamePriceSuffix(sub.planName)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {formatDisplayDate(sub.endDate)}
              </Text>
            </Space>
          );
        }
      },
      {
        title: "Overdue payments",
        key: "totalPending",
        width: 140,
        align: "right" as const,
        render: (_, record) => {
          const v = record.financialSummary?.lifetime?.totalPending ?? 0;
          if (v <= 0) {
            return <Text type="secondary">—</Text>;
          }
          return (
            <Text type="danger" strong>
              {formatInrWhole(v)}
            </Text>
          );
        }
      },
      {
        title: "Actions",
        key: "actions",
        width: 88,
        align: "center" as const,
        fixed: "right",
        render: (_, record) => (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              minHeight: 40
            }}
          >
            <Dropdown
              menu={{
                items: getRowActionItems(record),
                style: { minWidth: 240, padding: "8px 0" }
              }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="large"
                icon={<EllipsisOutlined style={{ fontSize: 18 }} />}
                aria-label="More actions"
              />
            </Dropdown>
          </div>
        )
      }
    ], [token, openView, getRowActionItems]);

  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => {
        const key = String(column.key ?? "") as MemberTableColumnKey;
        return visibleColumnKeys.includes(key);
      }),
    [columns, visibleColumnKeys]
  );

  const columnOptions: Array<{ label: string; value: MemberTableColumnKey }> = useMemo(
    () => [
      { label: "Member", value: "member" },
      { label: "Membership Status", value: "status" },
      { label: "Mobile Number", value: "phone" },
      { label: "Age", value: "age" },
      { label: "Membership", value: "plan" },
      { label: "Overdue payments", value: "totalPending" },
      { label: "Actions", value: "actions" }
    ],
    []
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
          <Select<MemberListFilter>
            style={{ minWidth: 200 }}
            value={memberListFilter}
            onChange={(v) => onMemberListFilterChange(v)}
            options={[
              { value: "all", label: "All members" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "overdue", label: "Overdue payments" }
            ]}
          />
          <Dropdown
            trigger={["click"]}
            popupRender={() => (
              <div
                style={{
                  background: token.colorBgElevated,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 8,
                  padding: 10,
                  minWidth: 220
                }}
              >
                <Checkbox.Group
                  style={{ display: "grid", gap: 6 }}
                  value={visibleColumnKeys}
                  onChange={(checked) => {
                    const next = checked.map((v) => String(v) as MemberTableColumnKey);
                    if (next.length === 0) {
                      return;
                    }
                    setVisibleColumnKeys(next);
                  }}
                >
                  {columnOptions.map((option) => (
                    <Checkbox key={option.value} value={option.value}>
                      {option.label}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </div>
            )}
          >
            <Button>Manage Columns</Button>
          </Dropdown>
          <ExportButton
            endpoint="/gym/exports/members"
            params={{
              branchId: effectiveBranchId || undefined,
              ...(memberListFilter === "overdue"
                ? { pendingPayment: "true" }
                : memberListFilter !== "all"
                  ? { status: memberListFilter }
                  : {}),
              search: nameSearch.trim() || undefined
            }}
            defaultFilename="members.csv"
            disabled={!effectiveBranchId}
          />
          <Button onClick={openImportModal} disabled={!canCreateMember || !effectiveBranchId}>
            Import members
          </Button>
          <Tooltip title={memberLimitReached ? "Member limit reached. Upgrade plan to add more members." : ""}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openCreate()}
              disabled={!canCreateMember || memberLimitReached}
            >
              Add member
            </Button>
          </Tooltip>
        </Space>
      </div>

      <Table<Member>
        rowKey="_id"
        loading={loading}
        columns={visibleColumns}
        dataSource={members}
        components={tableComponents}
        rowSelection={{ type: "checkbox" }}
        pagination={{
          current: membersPage,
          pageSize: membersPageSize,
          total: membersTotal,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["10", "25", "50", "100"],
          size: "small",
          onChange: (page, pageSize) => {
            setMembersPage(page);
            setMembersPageSize(pageSize);
          },
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
        }}
        scroll={{ x: 960, y: "calc(100vh - 120px)" }}
        tableLayout="fixed"
        locale={{ emptyText: "No Data Found" }}
      />

      <MemberDetailsModal
        open={detailOpen}
        member={detailMember}
        onClose={closeDetail}
      />

      <Modal
        title="Cancel membership"
        open={Boolean(cancelTarget)}
        onCancel={closeCancelMembershipModal}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        footer={[
          <Button key="cancel" onClick={closeCancelMembershipModal} disabled={cancelSubmitting}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={cancelSubmitting}
            onClick={() => {
              if (!cancelTarget?.currentSubscription) {
                return;
              }
              const paidAmount = Number(cancelTarget.currentSubscription.payment?.paidAmount ?? 0);
              const refundValue = Number(cancelRefundAmount ?? 0);
              if (!Number.isFinite(refundValue) || refundValue < 0) {
                message.error("Enter a valid refund amount.");
                return;
              }
              if (refundValue > paidAmount) {
                message.error("Refund amount cannot exceed paid amount.");
                return;
              }
              void handleCancelMembership(cancelTarget, refundValue);
            }}
          >
            Proceed Refund
          </Button>
        ]}
      >
        {cancelTarget?.currentSubscription ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <Text type="secondary">Membership amount</Text>
                <div>
                  <Text strong>{formatInrWhole(cancelTarget.currentSubscription.payment.totalAmount ?? 0)}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Paid amount</Text>
                <div>
                  <Text strong>{formatInrWhole(cancelTarget.currentSubscription.payment.paidAmount ?? 0)}</Text>
                </div>
              </div>
            </div>
            <div>
              <Text type="secondary">Refund amount</Text>
              <InputNumber
                style={{ width: "100%", marginTop: 6 }}
                min={0}
                max={Number(cancelTarget.currentSubscription.payment.paidAmount ?? 0)}
                step={100}
                value={cancelRefundAmount}
                onChange={(value) => setCancelRefundAmount(typeof value === "number" ? value : null)}
                placeholder="Enter refund amount"
              />
            </div>
          </Space>
        ) : (
          <Text type="secondary">No current membership found.</Text>
        )}
      </Modal>

      <Modal
        title="Import members"
        open={importOpen}
        onCancel={() => {
          if (importSubmitting) {
            return;
          }
          setImportOpen(false);
        }}
        footer={[
          <Button key="cancel" onClick={() => setImportOpen(false)} disabled={importSubmitting}>
            Cancel
          </Button>,
          <Button key="import" type="primary" loading={importSubmitting} onClick={() => void submitMemberImport()}>
            Start import
          </Button>
        ]}
      >
        <Text type="secondary">
          Accepted headers: customer_id, first_name, last_name, mobile_number(10_digit_only), gender, date_of_birth,
          date_of_joining, address, membership_start_date, membership_end_date, membership_plan, paid_amount
        </Text>
        <div style={{ marginTop: 12 }}>
          <Dragger
            multiple={false}
            accept=".xlsx,.xls"
            fileList={importFileList}
            beforeUpload={(file) => {
              const isExcel =
                file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
              if (!isExcel) {
                message.error("Only .xlsx or .xls files are allowed.");
                return Upload.LIST_IGNORE;
              }
              if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
                message.error("File size should be less than 2 MB.");
                return Upload.LIST_IGNORE;
              }
              return false;
            }}
            onChange={({ fileList }) => {
              setImportSummary(null);
              setImportFileList(fileList.slice(-1));
            }}
            onRemove={() => {
              setImportSummary(null);
              setImportFileList([]);
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag Excel file to this area</p>
            <p className="ant-upload-hint">Max size: 2 MB</p>
          </Dragger>
        </div>
        {importSummary ? (
          <Alert
            style={{ marginTop: 12 }}
            type={importSummary.failedCount ? "warning" : "success"}
            showIcon
            message={`Processed ${importSummary.totalRows ?? 0} rows. Success: ${importSummary.successCount ?? 0}, Failed: ${importSummary.failedCount ?? 0}.`}
            description={
              importSummary.failures && importSummary.failures.length > 0
                ? importSummary.failures
                    .slice(0, 10)
                    .map((failure) => `Row ${failure.row}: ${failure.message}`)
                    .join(" | ")
                : "All rows imported successfully."
            }
          />
        ) : null}
      </Modal>


      <Modal
        title={editing ? "Edit member" : newMembershipTarget ? "Assign new membership" : "Add or enroll member"}
        open={modalOpen}
        onCancel={requestCloseModal}
        width="min(1120px, calc(100vw - 24px))"
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        footer={[
          <Button key="cancel" onClick={requestCloseModal}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => void onSubmit()}>
            {editing
              ? "Save changes"
              : newMembershipTarget
                ? "Assign Membership"
                : lookupMember
                  ? "Enroll Existing Member"
                  : "Create Member"}
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          style={{ marginTop: 8 }}
          onValuesChange={(changedValues) => {
            setModalDirty(true);
            setDirty("members-modal", true);
            if ("miscFeesEnabled" in changedValues && changedValues.miscFeesEnabled === false) {
              form.setFieldValue("miscFeeAmount", 0);
            }
            if ("personalTrainerEnabled" in changedValues && changedValues.personalTrainerEnabled === false) {
              form.setFieldValue("personalTrainerFeeAmount", 0);
            }
          }}
        >
          {isAssigningNewMembership ? (
            <Alert
              type="info"
              showIcon
              message={`Assigning new membership for ${newMembershipTarget?.firstName ?? ""} ${newMembershipTarget?.lastName ?? ""}`.trim()}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {!isAssigningNewMembership && (
            <>

<Title level={5} style={sectionTitleStyle}>Basic details</Title>
<div style={sectionCardStyle}>
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
              <Form.Item label="Mobile number" required>
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
                  <Form.Item
                    name="phone"
                    noStyle
                    getValueFromEvent={(e) => stripToIndianMobileDigits(e.target?.value ?? e)}
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
                    <Input
                      placeholder="Enter 10 Digit Mobile Number"
                      maxLength={10}
                      style={{ width: "calc(100% - 56px)" }}
                    />
                  </Form.Item>
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

            </div>
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

          {/* <Form.Item
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
              onRemove={() => {
                setAvatarList([]);
                setModalDirty(true);
                setDirty("members-modal", true);
              }}
            >
              {avatarList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Form.Item> */}

          <Title level={5} style={sectionTitleStyle}>Personal details</Title>
          <div style={sectionCardStyle}>
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
          </div>

          <Title level={5} style={sectionTitleStyle}>Address</Title>
          <div style={sectionCardStyle}>
            <Form.Item name="street" label="Street Address">
              <Input prefix={<HomeOutlined />} placeholder="Enter street address" allowClear />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="city" label="City">
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select city"
                    options={cityOptions}
                    allowClear
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="state" label="State">
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select state"
                    options={stateOptions}
                    allowClear
                  />
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
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select country"
                    options={countryOptions}
                    allowClear
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
            </>
          )}

          {!editing && (
            <>
              <Title level={5} style={sectionTitleStyle}>Plan &amp; payment</Title>
              <div style={sectionCardStyle}>
                <Row gutter={[16, 16]} align="top">
                  <Col xs={24} lg={15}>
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
                                <Button type="link" onClick={() => startCreateMembershipFromMemberModal()} style={{ padding: 0 }}>
                                  Add membership plan
                                </Button>
                              )
                            }
                          />
                        </Form.Item>

                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="paymentMethod" label="Payment method">
                          <Select
                            options={[
                              { value: "cash", label: "Cash" },
                              { value: "upi", label: "UPI" },
                              { value: "card", label: "Card" }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                      
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="miscFeesEnabled" valuePropName="checked" style={{ marginBottom: 8 }}>
                          <Checkbox>Misc fees</Checkbox>
                        </Form.Item>
                        <Form.Item name="miscFeeAmount" label="Misc fee amount">
                          <InputNumber
                            min={0}
                            step={100}
                            disabled={!watchedMiscFeesEnabled}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="personalTrainerEnabled" valuePropName="checked" style={{ marginBottom: 8 }}>
                          <Checkbox>Personal trainer</Checkbox>
                        </Form.Item>
                        <Form.Item name="personalTrainerFeeAmount" label="Trainer fee amount">
                          <InputNumber
                            min={0}
                            step={100}
                            disabled={!watchedPersonalTrainerEnabled}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                     
                    </Row>

                    <Row gutter={16}>
                    <Col xs={24} sm={12}>
                        <Form.Item name="discountAmount" label="Discount (off subtotal)" tooltip="Reduces total after plan + misc + trainer fees.">
                          <InputNumber min={0} max={paymentPreview.subtotalAmount} step={100} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="paidAmount" label="Paid amount">
                          <InputNumber
                            min={0}
                            max={paymentPreview.finalPayableAmount}
                            step={100}
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Col>
                  <Col xs={24} lg={9}>
                    <div
                      style={{
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: 10,
                        padding: 12,
                        background: token.colorBgContainer
                      }}
                    >
                      <Space direction="vertical" size={6} style={{ width: "100%" }}>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Plan price</Text>
                          <Text style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.planAmount)}</Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Misc fees</Text>
                          <Text style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.miscFeeAmount)}</Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Trainer fees</Text>
                          <Text style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.personalTrainerFeeAmount)}</Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Subtotal</Text>
                          <Text style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.subtotalAmount)}</Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Discount</Text>
                          <Text type="secondary" style={paymentSummaryValueStyle}>
                            {paymentPreview.discountAmount > 0 ? `−${formatInrWhole(paymentPreview.discountAmount)}` : formatInrWhole(0)}
                          </Text>
                        </div>
                        <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, paddingTop: 8 }}>
                          <div style={paymentSummaryRowStyle}>
                            <Text strong>Final payable</Text>
                            <Text strong style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.finalPayableAmount)}</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.35, display: "block", marginTop: 4 }}>
                            Plan + misc + trainer − discount
                          </Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text>Paid amount</Text>
                          <Text style={paymentSummaryValueStyle}>{formatInrWhole(paymentPreview.paidAmount)}</Text>
                        </div>
                        <div style={paymentSummaryRowStyle}>
                          <Text type={paymentPreview.remainingAmount > 0 ? "warning" : "success"}>Remaining</Text>
                          <Text type={paymentPreview.remainingAmount > 0 ? "warning" : "success"} style={paymentSummaryValueStyle}>
                            {formatInrWhole(paymentPreview.remainingAmount)}
                          </Text>
                        </div>
                      </Space>
                    </div>
                  </Col>
                </Row>
              </div>
            </>
          )}

          {!isAssigningNewMembership && (
            <>
          <Title level={5} style={sectionTitleStyle}>Emergency contacts</Title>
          <div style={sectionCardStyle}>
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
          </div>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Notes (e.g. health)" />
          </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {overduePayMember ? (
        <OverduePaymentModal
          key={overduePayMember._id}
          open
          onClose={() => setOverduePayMember(null)}
          memberId={overduePayMember._id}
          memberDisplayName={`${overduePayMember.firstName} ${overduePayMember.lastName}`.trim()}
          totalPending={overduePayMember.financialSummary?.lifetime?.totalPending ?? 0}
          onSuccess={() => loadMembers()}
        />
      ) : null}
    </div>
  );
}
