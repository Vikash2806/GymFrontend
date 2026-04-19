"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import apiClient from "@/utils/api";
import { WIDE_DRAWER_WIDTH } from "@/utils/modalWidths";
import type {
  ExpenseCategoriesResponse,
  ExpenseCategory,
  ExpenseMutationResponse,
  ExpenseRow,
  ExpensesListResponse
} from "@/types/expense";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { gymMembershipRoleFromSession } from "@/utils/gymRole";
import { formatInr } from "@/utils/formatCurrency";

const { Title, Text } = Typography;

const MONTHS: { value: number; label: string }[] = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

type ExpenseFormValues = {
  branchId?: string | null;
  amount: number;
  date: Dayjs;
  categoryId?: string | null;
  notes?: string;
};

type CategoryFormValues = {
  name: string;
  description?: string;
};

export default function ExpensesPanel() {
  const { message } = App.useApp();
  const session = useAppSelector(selectSession);
  const role = gymMembershipRoleFromSession(session);
  const isOwner = role === "owner";
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [activeTab, setActiveTab] = useState("expenses");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseForm] = Form.useForm<ExpenseFormValues>();

  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryForm] = Form.useForm<CategoryFormValues>();

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => y - 5 + i);
  }, []);

  const branchOptions = useMemo(() => {
    const br = session?.gym?.branches ?? [];
    return br.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  }, [session?.gym?.branches]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const { data } = await apiClient.get<ExpenseCategoriesResponse>("/gym/expense-categories");
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        setCategories([]);
      }
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const { data } = await apiClient.get<ExpensesListResponse>("/gym/expenses", {
        params: { year, month }
      });
      if (data.success && Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
      } else {
        setExpenses([]);
      }
    } catch {
      setExpenses([]);
    } finally {
      setExpensesLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const openAddExpense = () => {
    setEditingExpense(null);
    expenseForm.resetFields();
    expenseForm.setFieldsValue({
      date: dayjs(),
      amount: undefined,
      branchId: isOwner ? undefined : defaultBranchId,
      categoryId: undefined,
      notes: undefined
    });
    setExpenseDrawerOpen(true);
  };

  const openEditExpense = (row: ExpenseRow) => {
    setEditingExpense(row);
    expenseForm.setFieldsValue({
      amount: row.amount,
      date: dayjs(row.date),
      branchId: row.branchId,
      categoryId: row.categoryId ?? undefined,
      notes: row.notes || undefined
    });
    setExpenseDrawerOpen(true);
  };

  const submitExpense = async () => {
    try {
      const v = await expenseForm.validateFields();
      setExpenseSubmitting(true);
      const payload: Record<string, unknown> = {
        amount: v.amount,
        date: v.date.toISOString(),
        notes: v.notes?.trim() ?? "",
        categoryId: v.categoryId ?? null
      };
      if (isOwner) {
        payload.branchId = v.branchId ?? null;
      }

      if (editingExpense) {
        const { data } = await apiClient.patch<ExpenseMutationResponse>(
          `/gym/expenses/${editingExpense.id}`,
          payload
        );
        if (data.success) {
          message.success("Expense updated.");
          setExpenseDrawerOpen(false);
          void loadExpenses();
        } else if (data.message) {
          message.error(data.message);
        }
      } else {
        const { data } = await apiClient.post<ExpenseMutationResponse>("/gym/expenses", payload);
        if (data.success) {
          message.success("Expense added.");
          setExpenseDrawerOpen(false);
          void loadExpenses();
        } else if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      message.error("Could not save expense.");
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const deleteExpense = async (row: ExpenseRow) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(
        `/gym/expenses/${row.id}`
      );
      if (data.success) {
        message.success("Expense deleted.");
        void loadExpenses();
      } else if (data.message) {
        message.error(data.message);
      }
    } catch {
      message.error("Could not delete expense.");
    }
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    categoryForm.resetFields();
    setCategoryDrawerOpen(true);
  };

  const openEditCategory = (row: ExpenseCategory) => {
    setEditingCategory(row);
    categoryForm.setFieldsValue({ name: row.name, description: row.description });
    setCategoryDrawerOpen(true);
  };

  const submitCategory = async () => {
    try {
      const v = await categoryForm.validateFields();
      setCategorySubmitting(true);
      if (editingCategory) {
        const { data } = await apiClient.patch<ExpenseMutationResponse>(
          `/gym/expense-categories/${editingCategory.id}`,
          v
        );
        if (data.success) {
          message.success("Category updated.");
          setCategoryDrawerOpen(false);
          void loadCategories();
        } else if (data.message) {
          message.error(data.message);
        }
      } else {
        const { data } = await apiClient.post<ExpenseMutationResponse>("/gym/expense-categories", v);
        if (data.success) {
          message.success("Category saved.");
          setCategoryDrawerOpen(false);
          void loadCategories();
        } else if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) {
        return;
      }
      message.error("Could not save category.");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const deleteCategory = async (row: ExpenseCategory) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(
        `/gym/expense-categories/${row.id}`
      );
      if (data.success) {
        message.success("Category deleted.");
        void loadCategories();
      } else if (data.message) {
        message.error(data.message);
      }
    } catch {
      message.error("Could not delete category.");
    }
  };

  const expenseColumns: ColumnsType<ExpenseRow> = [
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (a: number) => formatInr(a)
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("DD-MM-YYYY")
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, row) => row.branchName ?? "All branches"
    },
    {
      title: "Category",
      key: "category",
      render: (_, row) => row.categoryName ?? "—"
    },
    {
      title: "Notes / Description",
      dataIndex: "notes",
      key: "notes",
      ellipsis: true
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditExpense(row)}>
            Edit
          </Button>
          <Popconfirm title="Delete this expense?" onConfirm={() => void deleteExpense(row)}>
            <Button type="link" size="small" danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const categoryColumns: ColumnsType<ExpenseCategory> = [
    { title: "Category Name", dataIndex: "name", key: "name" },
    { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditCategory(row)}>
            Edit
          </Button>
          <Popconfirm title="Delete this category?" onConfirm={() => void deleteCategory(row)}>
            <Button type="link" size="small" danger>
              Delete
            </Button>
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
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Expenses
        </Title>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "expenses",
            label: "Expenses",
            children: (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16
                  }}
                >
                  <Space wrap>
                    <Select
                      style={{ width: 120 }}
                      value={year}
                      onChange={setYear}
                      options={yearOptions.map((y) => ({ value: y, label: String(y) }))}
                    />
                    <Select
                      style={{ width: 140 }}
                      value={month}
                      onChange={setMonth}
                      options={MONTHS.map((m) => ({ value: m.value, label: m.label }))}
                    />
                  </Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddExpense}>
                    Add expense
                  </Button>
                </div>
                <Table<ExpenseRow>
                  rowKey="id"
                  loading={expensesLoading}
                  columns={expenseColumns}
                  dataSource={expenses}
                  pagination={false}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span>
                            <div>No expenses found</div>
                            <Text type="secondary">Add an expense using the button above.</Text>
                          </span>
                        }
                      />
                    )
                  }}
                />
              </>
            )
          },
          {
            key: "categories",
            label: "Categories",
            children: (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddCategory}>
                    Add category
                  </Button>
                </div>
                <Table<ExpenseCategory>
                  rowKey="id"
                  loading={categoriesLoading}
                  columns={categoryColumns}
                  dataSource={categories}
                  pagination={false}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <span>
                            <div>No categories found</div>
                            <Text type="secondary">Add a category using the button above.</Text>
                          </span>
                        }
                      />
                    )
                  }}
                />
              </>
            )
          }
        ]}
      />

      <Drawer
        title={editingExpense ? "Edit expense" : "Add expense"}
        width={WIDE_DRAWER_WIDTH}
        open={expenseDrawerOpen}
        onClose={() => setExpenseDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setExpenseDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={expenseSubmitting} onClick={() => void submitExpense()}>
              {editingExpense ? "Save" : "Add"}
            </Button>
          </Space>
        }
      >
        <Form form={expenseForm} layout="vertical" requiredMark>
          {isOwner ? (
            <Form.Item name="branchId" label="Branch (optional)">
              <Select
                allowClear
                placeholder="All branches (no branch)"
                options={branchOptions}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: "Enter amount" }]}
          >
            <InputNumber
              min={0.01}
              style={{ width: "100%" }}
              prefix="₹"
              placeholder="Enter amount"
            />
          </Form.Item>
          <Form.Item
            name="date"
            label="Date"
            rules={[{ required: true, message: "Select date" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select
              allowClear
              placeholder={categories.length ? "Select category" : "No categories available"}
              options={categoryOptions}
              loading={categoriesLoading}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={3} placeholder="Short note" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingCategory ? "Edit category" : "Add category"}
        width={WIDE_DRAWER_WIDTH}
        open={categoryDrawerOpen}
        onClose={() => setCategoryDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setCategoryDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={categorySubmitting} onClick={() => void submitCategory()}>
              {editingCategory ? "Save" : "Save"}
            </Button>
          </Space>
        }
      >
        <Form form={categoryForm} layout="vertical" requiredMark>
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: "Enter category name" }]}
          >
            <Input placeholder="Enter category name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} placeholder="Enter category description" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
