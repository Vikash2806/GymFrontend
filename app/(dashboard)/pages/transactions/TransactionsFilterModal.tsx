"use client";

import React, { useEffect } from "react";
import { Button, Col, DatePicker, Input, InputNumber, Modal, Row, Select, Space } from "antd";
import type { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

export type TransactionFilters = {
  search: string;
  branchId: string;
  status: "all" | "success" | "pending" | "failed" | "refunded";
  method: "all" | "cash" | "upi" | "card";
  dateRange: [Dayjs | null, Dayjs | null] | null;
  minAmount: number | null;
  maxAmount: number | null;
  sortBy: "paidAt" | "createdAt" | "amount";
  sortOrder: "desc" | "asc";
};

type BranchOption = { value: string; label: string };

type TransactionsFilterModalProps = {
  open: boolean;
  branchOptions: BranchOption[];
  currentFilters: TransactionFilters;
  onClose: () => void;
  onApply: (filters: TransactionFilters) => void;
  onClear: () => void;
};

export default function TransactionsFilterModal({
  open,
  branchOptions,
  currentFilters,
  onClose,
  onApply,
  onClear
}: TransactionsFilterModalProps) {
  const [draftFilters, setDraftFilters] = React.useState<TransactionFilters>(currentFilters);

  useEffect(() => {
    if (open) {
      setDraftFilters(currentFilters);
    }
  }, [open, currentFilters]);

  return (
    <Modal
      title="Filter Transactions"
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="clear" onClick={onClear}>
          Clear Filters
        </Button>,
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="search" type="primary" onClick={() => onApply(draftFilters)}>
          Search
        </Button>
      ]}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Input
              allowClear
              placeholder="Search member, phone, plan, ref"
              value={draftFilters.search}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value.trim() }))}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              value={draftFilters.branchId || undefined}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, branchId: value ?? "" }))}
              placeholder="Branch"
              options={branchOptions}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <Select
              value={draftFilters.status}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: "all", label: "All status" },
                { value: "success", label: "Success" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
                { value: "refunded", label: "Refunded" }
              ]}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              value={draftFilters.method}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, method: value }))}
              options={[
                { value: "all", label: "All methods" },
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI" },
                { value: "card", label: "Card" }
              ]}
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <RangePicker
              value={draftFilters.dateRange}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, dateRange: value }))}
              format="DD-MM-YYYY"
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12}>
            <InputNumber
              min={0}
              step={100}
              value={draftFilters.minAmount}
              onChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, minAmount: typeof value === "number" ? value : null }))
              }
              placeholder="Min amount"
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <InputNumber
              min={0}
              step={100}
              value={draftFilters.maxAmount}
              onChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, maxAmount: typeof value === "number" ? value : null }))
              }
              placeholder="Max amount"
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              value={draftFilters.sortBy}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, sortBy: value }))}
              options={[
                { value: "paidAt", label: "Sort by Paid At" },
                { value: "createdAt", label: "Sort by Created At" },
                { value: "amount", label: "Sort by Amount" }
              ]}
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <Select
              value={draftFilters.sortOrder}
              onChange={(value) => setDraftFilters((prev) => ({ ...prev, sortOrder: value }))}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" }
              ]}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Space>
    </Modal>
  );
}
