"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Input, Space, Table, Typography, theme } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TableProps } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import apiClient from "@/utils/api";
import { formatInr } from "@/utils/formatCurrency";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { FEATURES, hasModuleAction } from "@/utils/permissions";
import ExportButton from "@/app/components/Export/ExportButton";
import OverduePaymentModal from "@/app/components/payments/OverduePaymentModal";

const { Title, Text } = Typography;

const TABLE_HEADER_STYLE: React.CSSProperties = { fontSize: 15, fontWeight: 600 };

const tableComponents: TableProps<BillingRecord>["components"] = {
  header: {
    cell: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
      <th {...props} style={{ ...props.style, ...TABLE_HEADER_STYLE }} />
    )
  }
};

type BillingRecord = {
  memberId: string;
  memberName: string;
  phone: string;
  branchId: string;
  subscriptionId: string;
  planName: string;
  membershipStatus: "active" | "expired" | "cancelled" | "paused";
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  canAddPayment: boolean;
};

type ListResponse = {
  success: boolean;
  records?: BillingRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

export default function BillingPanel() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const canExportMembers = hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "export");
  const canRecordOverduePayment = hasModuleAction(session, FEATURES.MEMBER_MANAGEMENT, "overdue_payment");
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<BillingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [branchFilter, setBranchFilter] = useState<string>(defaultBranchId);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingMember, setPayingMember] = useState<BillingRecord | null>(null);

  useEffect(() => {
    if (defaultBranchId && branchFilter !== defaultBranchId) {
      setBranchFilter(defaultBranchId);
      setPage(1);
    }
  }, [defaultBranchId, branchFilter]);

  const branchCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of session?.gym?.branches ?? []) {
      map.set(b.id, b.code);
    }
    return map;
  }, [session?.gym?.branches]);

  const loadMembers = useCallback(async () => {
    if (!branchFilter) {
      setMembers([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        branchId: branchFilter,
        page: String(page),
        pageSize: String(pageSize)
      };
      const q = search.trim();
      if (q) {
        params.search = q;
      }
      const { data } = await apiClient.get<ListResponse>("/gym/billing/records", { params });
      if (data.success && Array.isArray(data.records)) {
        setMembers(data.records);
        setTotal(typeof data.total === "number" ? data.total : data.records.length);
      } else {
        setMembers([]);
        setTotal(0);
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
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, search, page, pageSize, message]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const openPay = useCallback(
    (record: BillingRecord) => {
      if (!record.canAddPayment) {
        message.warning("No active subscription on file for this member.");
        return;
      }
      setPayingMember(record);
      setPayModalOpen(true);
    },
    [message]
  );

  const closePay = () => {
    setPayModalOpen(false);
    setPayingMember(null);
  };

  const columns: ColumnsType<BillingRecord> = useMemo(
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
                {record.memberName}
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
        render: (_, record) => record.planName
      },
      {
        title: "Status",
        key: "membershipStatus",
        width: 120,
        render: (_, record) => (
          <Text style={{ color: record.membershipStatus === "cancelled" ? token.colorError : token.colorText }}>
            {record.membershipStatus.toUpperCase()}
          </Text>
        )
      },
      {
        title: "Total Amount",
        key: "total",
        width: 140,
        align: "right" as const,
        render: (_, record) => formatInr(record.totalAmount)
      },
      {
        title: "Paid Amount",
        key: "paid",
        width: 140,
        align: "right" as const,
        render: (_, record) => formatInr(record.paidAmount)
      },
      {
        title: "Remaining Amount",
        key: "overdue",
        width: 150,
        align: "right" as const,
        render: (_, record) => (
          <Text style={{ color: record.pendingAmount > 0 ? token.colorWarning : token.colorTextSecondary }}>
            {formatInr(record.pendingAmount)}
          </Text>
        )
      },
      {
        title: "Actions",
        key: "actions",
        width: 160,
        fixed: "right" as const,
        render: (_, record) =>
          canRecordOverduePayment ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openPay(record)}
              disabled={!record.canAddPayment}
            >
              Add Payment
            </Button>
          ) : null
      }
    ],
    [
      branchCodeById,
      canRecordOverduePayment,
      openPay,
      token.colorError,
      token.colorText,
      token.colorTextSecondary,
      token.colorWarning
    ]
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
            onSearch={(v) => {
              setPage(1);
              setSearch(v);
            }}
            onClear={() => {
              setPage(1);
              setSearchDraft("");
              setSearch("");
            }}
            enterButton
          />
          {canExportMembers ? (
            <ExportButton
              endpoint="/gym/exports/overdue-payments"
              params={{
                branchId: branchFilter || undefined,
                search: search.trim() || undefined
              }}
              defaultFilename="overdue-payments.csv"
              disabled={!branchFilter}
            />
          ) : null}
        </Space>
      </div>

      <Table<BillingRecord>
        rowKey={(row) => `${row.memberId}-${row.subscriptionId}`}
        loading={loading}
        columns={columns}
        dataSource={members}
        components={tableComponents}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "25", "50", "100"],
          showQuickJumper: true,
          hideOnSinglePage: false,
          position: ["bottomRight"],
          size: "small",
          showTotal: (value, range) => `${range[0]}-${range[1]} of ${value} pending payments`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          }
        }}
        scroll={{ x: 960, y: "calc(100vh - 120px)" }}
        tableLayout="fixed"
        locale={{ emptyText: "No overdue payments" }}
      />

      {payingMember ? (
        <OverduePaymentModal
          key={payingMember.subscriptionId}
          open={payModalOpen}
          onClose={closePay}
          memberId={payingMember.memberId}
          memberDisplayName={`${payingMember.memberName} (+91${payingMember.phone})`}
          totalPending={payingMember.pendingAmount}
          subscriptionId={payingMember.subscriptionId}
          onSuccess={() => loadMembers()}
        />
      ) : null}
    </div>
  );
}
