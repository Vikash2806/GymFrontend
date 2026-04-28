"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, DatePicker, Input, InputNumber, Modal, Row, Select, Space } from "antd";
import type { Dayjs } from "dayjs";
import type { ExpenseCategory } from "@/types/expense";

const { RangePicker } = DatePicker;

export type ExpenseFilters = {
  search: string;
  categoryId: string;
  employeeUserId: string;
  expenseKind: "all" | "employee_related" | "general";
  dateRange: [Dayjs, Dayjs];
  minAmount: number | null;
  maxAmount: number | null;
};

type Props = {
  open: boolean;
  currentFilters: ExpenseFilters;
  categories: ExpenseCategory[];
  employeeOptions: Array<{ value: string; label: string }>;
  employeesLoading?: boolean;
  onClose: () => void;
  onApply: (filters: ExpenseFilters) => void;
  onClear: () => void;
};

export default function ExpensesFilterModal({
  open,
  currentFilters,
  categories,
  employeeOptions,
  employeesLoading = false,
  onClose,
  onApply,
  onClear
}: Props) {
  const [draft, setDraft] = useState<ExpenseFilters>(currentFilters);

  useEffect(() => {
    if (open) {
      setDraft(currentFilters);
    }
  }, [open, currentFilters]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === draft.categoryId) ?? null,
    [categories, draft.categoryId]
  );
  const employeeEnabled = selectedCategory?.showEmployeeDetails === true && selectedCategory?.listBranchUsers === true;

  useEffect(() => {
    if (!employeeEnabled && draft.employeeUserId) {
      setDraft((prev) => ({ ...prev, employeeUserId: "" }));
    }
  }, [employeeEnabled, draft.employeeUserId]);

  return (
    <Modal
      title="Filter Expenses"
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
        <Button key="search" type="primary" onClick={() => onApply(draft)}>
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
              placeholder="Search category, employee, notes"
              value={draft.search}
              onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value.trim() }))}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              allowClear
              value={draft.categoryId || undefined}
              placeholder="Filter by category"
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              onChange={(value) => setDraft((prev) => ({ ...prev, categoryId: value ?? "", employeeUserId: "" }))}
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <Select
              value={draft.expenseKind}
              options={[
                { value: "all", label: "All expense types" },
                { value: "employee_related", label: "Employee related" },
                { value: "general", label: "General" }
              ]}
              onChange={(value) => setDraft((prev) => ({ ...prev, expenseKind: value }))}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Select
              allowClear
              value={draft.employeeUserId || undefined}
              placeholder={employeeEnabled ? "Filter by employee" : "Employee filter enabled for selected employee categories"}
              options={employeeOptions}
              loading={employeesLoading}
              disabled={!employeeEnabled}
              onChange={(value) => setDraft((prev) => ({ ...prev, employeeUserId: value ?? "" }))}
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <RangePicker
              value={draft.dateRange}
              format="DD-MM-YYYY"
              onChange={(value) => {
                if (!value?.[0] || !value?.[1]) {
                  return;
                }
                const [start, end] = value;
                setDraft((prev) => ({ ...prev, dateRange: [start, end] }));
              }}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} md={12}>
            <InputNumber
              min={0}
              step={100}
              value={draft.minAmount}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, minAmount: typeof value === "number" ? value : null }))
              }
              placeholder="Min amount"
              style={{ width: "100%" }}
            />
          </Col>

          <Col xs={24} md={12}>
            <InputNumber
              min={0}
              step={100}
              value={draft.maxAmount}
              onChange={(value) =>
                setDraft((prev) => ({ ...prev, maxAmount: typeof value === "number" ? value : null }))
              }
              placeholder="Max amount"
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Space>
    </Modal>
  );
}
