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
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import apiClient from "@/utils/api";
import { WIDE_DRAWER_WIDTH } from "@/utils/modalWidths";
import type {
  ExpenseCategoriesResponse,
  ExpenseCategorySummaryResponse,
  ExpenseCategorySummaryRow,
  ExpenseCategory,
  ExpenseEmployeeOption,
  ExpenseEmployeesResponse,
  ExpenseMutationResponse,
  ExpenseRow,
  ExpensesListResponse
} from "@/types/expense";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { formatInr } from "@/utils/formatCurrency";
import ExportButton from "@/app/components/Export/ExportButton";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type ExpenseType =
  | "employee_salary"
  | "equipment_repair"
  | "sanitary_worker_salary"
  | "gym_rent"
  | "food_expense"
  | "custom";
type SalaryFilter = "all" | "salary_only" | "employee_salary" | "sanitary_worker_salary";

const EXPENSE_TYPE_OPTIONS: Array<{ value: ExpenseType; label: string }> = [
  { value: "employee_salary", label: "Employee Salary" },
  { value: "equipment_repair", label: "Equipment Repair" },
  { value: "sanitary_worker_salary", label: "Sanitary Worker Salary" },
  { value: "gym_rent", label: "Gym Rent" },
  { value: "food_expense", label: "Food Expense" },
  { value: "custom", label: "Custom Category" }
];

type ExpenseFormValues = {
  expenseType: ExpenseType;
  employeeUserId?: string;
  amount: number;
  date: Dayjs;
  categoryId?: string;
  notes?: string;
};

type CategoryFormValues = {
  name: string;
  description?: string;
};

export default function ExpensesPanel() {
  const { message } = App.useApp();
  const session = useAppSelector(selectSession);
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [activeTab, setActiveTab] = useState("expenses");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => [dayjs().startOf("month"), dayjs().endOf("month")]);
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<"all" | ExpenseType>("all");
  const [salaryFilter, setSalaryFilter] = useState<SalaryFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");

  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize, setExpensesPageSize] = useState(10);
  const [expensesTotal, setExpensesTotal] = useState(0);

  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [staffUsers, setStaffUsers] = useState<ExpenseEmployeeOption[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<ExpenseCategorySummaryRow[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);

  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseForm] = Form.useForm<ExpenseFormValues>();

  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();

  const watchedExpenseType = Form.useWatch("expenseType", expenseForm);
  const isSalaryExpense =
    watchedExpenseType === "employee_salary" || watchedExpenseType === "sanitary_worker_salary";
  const isCustomExpense = watchedExpenseType === "custom";

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const employeeOptions = useMemo(
    () => staffUsers.map((e) => ({ value: e.id, label: `${e.fullName} (${e.role === "manager" ? "Manager" : "Staff"})` })),
    [staffUsers]
  );

  const buildExpenseQueryParams = useCallback(
    (forExport = false) => {
      const params: Record<string, string | number> = {
        startDate: dateRange[0].startOf("day").toISOString(),
        endDate: dateRange[1].startOf("day").toISOString()
      };
      if (!forExport) {
        params.page = expensesPage;
        params.pageSize = expensesPageSize;
      }
      if (defaultBranchId) {
        params.branchId = defaultBranchId;
      }
      if (expenseTypeFilter !== "all") {
        params.expenseType = expenseTypeFilter;
      }
      if (salaryFilter !== "all") {
        params.salaryFilter = salaryFilter;
      }
      if (categoryFilter) {
        params.categoryId = categoryFilter;
      }
      if (employeeFilter) {
        params.employeeUserId = employeeFilter;
      }
      return params;
    },
    [dateRange, expensesPage, expensesPageSize, defaultBranchId, expenseTypeFilter, salaryFilter, categoryFilter, employeeFilter]
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

  const loadEmployees = useCallback(async () => {
    setEmployeesLoading(true);
    try {
      const params: Record<string, string> = {};
      if (defaultBranchId) {
        params.branchId = defaultBranchId;
      }
      const { data } = await apiClient.get<ExpenseEmployeesResponse>("/gym/expenses/staff-users", { params });
      if (data.success && Array.isArray(data.staffUsers)) {
        setStaffUsers(data.staffUsers);
      } else {
        setStaffUsers([]);
      }
    } catch {
      setStaffUsers([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, [defaultBranchId]);

  const loadExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const { data } = await apiClient.get<ExpensesListResponse>("/gym/expenses", { params: buildExpenseQueryParams() });
      if (data.success && Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        setExpensesTotal(typeof data.total === "number" ? data.total : data.expenses.length);
      } else {
        setExpenses([]);
        setExpensesTotal(0);
      }
    } catch {
      setExpenses([]);
      setExpensesTotal(0);
    } finally {
      setExpensesLoading(false);
    }
  }, [buildExpenseQueryParams]);

  const loadCategorySummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const { data } = await apiClient.get<ExpenseCategorySummaryResponse>("/gym/expenses/category-summary", {
        params: buildExpenseQueryParams(true)
      });
      if (data.success && Array.isArray(data.summary)) {
        setSummaryRows(data.summary);
        setSummaryTotal(typeof data.totalAmount === "number" ? data.totalAmount : 0);
      } else {
        setSummaryRows([]);
        setSummaryTotal(0);
        if (data.message) {
          message.error(data.message);
        }
      }
    } catch (e: unknown) {
      setSummaryRows([]);
      setSummaryTotal(0);
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      message.error(msg ?? "Could not load category-wise aggregation.");
    } finally {
      setSummaryLoading(false);
    }
  }, [buildExpenseQueryParams, message]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    void loadCategorySummary();
  }, [loadCategorySummary]);

  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseDrawerOpen(true);
    clearDirty("expenses-expense-drawer");
  };

  const openEditExpense = (row: ExpenseRow) => {
    setEditingExpense(row);
    setExpenseDrawerOpen(true);
    clearDirty("expenses-expense-drawer");
  };

  useEffect(() => {
    if (!expenseDrawerOpen) {
      return;
    }
    if (editingExpense) {
      expenseForm.setFieldsValue({
        expenseType: editingExpense.expenseType ?? "custom",
        employeeUserId: editingExpense.employeeUserId ?? undefined,
        amount: editingExpense.amount,
        date: dayjs(editingExpense.date),
        categoryId: editingExpense.categoryId ?? undefined,
        notes: editingExpense.notes || undefined
      });
      return;
    }
    expenseForm.resetFields();
    expenseForm.setFieldsValue({
      date: dayjs(),
      amount: undefined,
      expenseType: "employee_salary",
      employeeUserId: undefined,
      categoryId: undefined,
      notes: undefined
    });
  }, [expenseDrawerOpen, editingExpense, expenseForm, defaultBranchId]);

  const submitExpense = async () => {
    try {
      if (!defaultBranchId) {
        message.error("No active branch selected.");
        return;
      }
      const v = await expenseForm.validateFields();
      setExpenseSubmitting(true);
      const payload: Record<string, unknown> = {
        branchId: defaultBranchId,
        expenseType: v.expenseType,
        employeeUserId: v.employeeUserId ?? null,
        amount: v.amount,
        date: v.date.toISOString(),
        notes: v.notes?.trim() ?? "",
        categoryId: v.categoryId ?? null
      };
      if (editingExpense) {
        const { data } = await apiClient.patch<ExpenseMutationResponse>(
          `/gym/expenses/${editingExpense.id}`,
          payload
        );
        if (data.success) {
          message.success("Expense updated.");
          setExpenseDrawerOpen(false);
          clearDirty("expenses-expense-drawer");
          void loadExpenses();
          void loadCategorySummary();
        } else if (data.message) {
          message.error(data.message);
        }
      } else {
        const { data } = await apiClient.post<ExpenseMutationResponse>("/gym/expenses", payload);
        if (data.success) {
          message.success("Expense added.");
          setExpenseDrawerOpen(false);
          clearDirty("expenses-expense-drawer");
          void loadExpenses();
          void loadCategorySummary();
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
        void loadCategorySummary();
      } else if (data.message) {
        message.error(data.message);
      }
    } catch {
      message.error("Could not delete expense.");
    }
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryDrawerOpen(true);
    clearDirty("expenses-category-drawer");
  };

  const openEditCategory = (row: ExpenseCategory) => {
    setEditingCategory(row);
    setCategoryDrawerOpen(true);
    clearDirty("expenses-category-drawer");
  };

  useEffect(() => {
    if (!categoryDrawerOpen) {
      return;
    }
    if (editingCategory) {
      categoryForm.setFieldsValue({ name: editingCategory.name, description: editingCategory.description });
      return;
    }
    categoryForm.resetFields();
  }, [categoryDrawerOpen, editingCategory, categoryForm]);

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
          clearDirty("expenses-category-drawer");
          void loadCategories();
        } else if (data.message) {
          message.error(data.message);
        }
      } else {
        const { data } = await apiClient.post<ExpenseMutationResponse>("/gym/expense-categories", v);
        if (data.success) {
          message.success("Category saved.");
          setCategoryDrawerOpen(false);
          clearDirty("expenses-category-drawer");
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
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("DD-MM-YYYY")
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (a: number) => formatInr(a)
    },
    {
      title: "Expense Type",
      key: "expenseType",
      render: (_, row) =>
        row.expenseTypeLabel ??
        EXPENSE_TYPE_OPTIONS.find((opt) => opt.value === row.expenseType)?.label ??
        row.expenseType
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, row) => row.branchName ?? "—"
    },
    {
      title: "Employee",
      key: "employee",
      render: (_, row) => row.employeeName ?? "—"
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

  const summaryColumns: ColumnsType<ExpenseCategorySummaryRow> = [
    { title: "Category", dataIndex: "categoryName", key: "categoryName" },
    {
      title: "Expenses",
      dataIndex: "expenseCount",
      key: "expenseCount",
      width: 120
    },
    {
      title: "Total Amount",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 180,
      render: (amount: number) => formatInr(amount)
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
                    <RangePicker
                      value={dateRange}
                      format="DD-MM-YYYY"
                      onChange={(v) => {
                        if (!v?.[0] || !v?.[1]) {
                          return;
                        }
                        setExpensesPage(1);
                        setDateRange([v[0], v[1]]);
                      }}
                    />
                    <Select
                      style={{ minWidth: 220 }}
                      value={expenseTypeFilter}
                      onChange={(value) => {
                        setExpensesPage(1);
                        setExpenseTypeFilter(value);
                      }}
                      options={[
                        { value: "all", label: "All expense types" },
                        ...EXPENSE_TYPE_OPTIONS
                      ]}
                    />
                    <Select
                      style={{ minWidth: 220 }}
                      value={salaryFilter}
                      onChange={(value) => {
                        setExpensesPage(1);
                        setSalaryFilter(value);
                      }}
                      options={[
                        { value: "all", label: "All (salary + non-salary)" },
                        { value: "salary_only", label: "Salary only" },
                        { value: "employee_salary", label: "Employee salary only" },
                        { value: "sanitary_worker_salary", label: "Sanitary worker salary only" }
                      ]}
                    />
                    <Select
                      allowClear
                      style={{ minWidth: 220 }}
                      placeholder="Filter by employee"
                      value={employeeFilter || undefined}
                      onChange={(value) => {
                        setExpensesPage(1);
                        setEmployeeFilter(value ?? "");
                      }}
                      options={employeeOptions}
                      loading={employeesLoading}
                    />
                    <Select
                      allowClear
                      style={{ minWidth: 220 }}
                      placeholder="Filter by custom category"
                      value={categoryFilter || undefined}
                      onChange={(value) => {
                        setExpensesPage(1);
                        setCategoryFilter(value ?? "");
                      }}
                      options={categoryOptions}
                    />
                  </Space>
                  <Space wrap>
                    <ExportButton
                      endpoint="/gym/exports/expenses"
                      params={buildExpenseQueryParams(true)}
                      defaultFilename="expenses.csv"
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={openAddExpense}>
                      Add expense
                    </Button>
                  </Space>
                </div>
                <Table<ExpenseRow>
                  rowKey="id"
                  loading={expensesLoading}
                  columns={expenseColumns}
                  dataSource={expenses}
                  pagination={{
                    current: expensesPage,
                    pageSize: expensesPageSize,
                    total: expensesTotal,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50"],
                    onChange: (page, pageSize) => {
                      setExpensesPage(page);
                      setExpensesPageSize(pageSize);
                    },
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} expenses`
                  }}
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
                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                      gap: 12
                    }}
                  >
                    <Text strong>Expense-head aggregation</Text>
                    <Text strong>Total: {formatInr(summaryTotal)}</Text>
                  </div>
                  <Table<ExpenseCategorySummaryRow>
                    rowKey={(row) => row.categoryId ?? "uncategorized"}
                    loading={summaryLoading}
                    columns={summaryColumns}
                    dataSource={summaryRows}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <span>
                              <div>No category totals for selected period</div>
                              <Text type="secondary">Add expenses to see category-wise totals.</Text>
                            </span>
                          }
                        />
                      )
                    }}
                  />
                </div>
              </>
            )
          },
          {
            key: "categories",
            label: "Categories",
            children: (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadCategories()}>
                    Refresh
                  </Button>
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
        onClose={() => {
          const close = () => {
            setExpenseDrawerOpen(false);
            clearDirty("expenses-expense-drawer");
          };
          if (expenseForm.isFieldsTouched(true)) {
            confirmNavigation(close);
            return;
          }
          close();
        }}
        destroyOnHidden
        extra={
          <Space>
            <Button
              onClick={() => {
                const close = () => {
                  setExpenseDrawerOpen(false);
                  clearDirty("expenses-expense-drawer");
                };
                if (expenseForm.isFieldsTouched(true)) {
                  confirmNavigation(close);
                  return;
                }
                close();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" loading={expenseSubmitting} onClick={() => void submitExpense()}>
              Save
            </Button>
          </Space>
        }
      >
        <Form
          form={expenseForm}
          layout="vertical"
          requiredMark
          onValuesChange={() => {
            setDirty("expenses-expense-drawer", true);
          }}
        >
          <Form.Item
            name="expenseType"
            label="Expense Type"
            rules={[{ required: true, message: "Select expense type" }]}
          >
            <Select
              options={EXPENSE_TYPE_OPTIONS}
              onChange={() => {
                expenseForm.setFieldsValue({ employeeUserId: undefined });
                if (expenseForm.getFieldValue("expenseType") !== "custom") {
                  expenseForm.setFieldsValue({ categoryId: undefined });
                }
              }}
            />
          </Form.Item>
          {isSalaryExpense ? (
            <Form.Item
              name="employeeUserId"
              label={
                watchedExpenseType === "sanitary_worker_salary"
                  ? "Select sanitary staff/manager to pay salary"
                  : "Select staff/manager to pay salary"
              }
              rules={[{ required: true, message: "Select staff/manager" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={employeeOptions}
                loading={employeesLoading}
                placeholder="Select staff/manager"
              />
            </Form.Item>
          ) : null}
          <Form.Item
            name="amount"
            label={isSalaryExpense ? "Salary Amount" : "Amount"}
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
          {isCustomExpense ? (
            <Form.Item
              name="categoryId"
              label="Custom Category"
              rules={[{ required: true, message: "Select category" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={categories.length ? "Select category" : "No categories available"}
                options={categoryOptions}
                loading={categoriesLoading}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={3} placeholder="Short note" />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={editingCategory ? "Edit category" : "Add category"}
        width={WIDE_DRAWER_WIDTH}
        open={categoryDrawerOpen}
        onClose={() => {
          const close = () => {
            setCategoryDrawerOpen(false);
            clearDirty("expenses-category-drawer");
          };
          if (categoryForm.isFieldsTouched(true)) {
            confirmNavigation(close);
            return;
          }
          close();
        }}
        destroyOnHidden
        extra={
          <Space>
            <Button
              onClick={() => {
                const close = () => {
                  setCategoryDrawerOpen(false);
                  clearDirty("expenses-category-drawer");
                };
                if (categoryForm.isFieldsTouched(true)) {
                  confirmNavigation(close);
                  return;
                }
                close();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" loading={categorySubmitting} onClick={() => void submitCategory()}>
              {editingCategory ? "Save" : "Save"}
            </Button>
          </Space>
        }
      >
        <Form
          form={categoryForm}
          layout="vertical"
          requiredMark
          onValuesChange={() => {
            setDirty("expenses-category-drawer", true);
          }}
        >
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
