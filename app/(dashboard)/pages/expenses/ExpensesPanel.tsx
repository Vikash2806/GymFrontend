"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Table,
  Tabs,
  Typography,
  theme
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, FilterOutlined, PlusOutlined } from "@ant-design/icons";
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
import ExpensesFilterModal, { type ExpenseFilters } from "./ExpensesFilterModal";
import type { GymUsageSnapshotResponse } from "@/types/usage";

const { Title, Text } = Typography;
const FILTER_STORAGE_KEY = "expenseFilters";
const GENERAL_EMPLOYEE_OPTION_VALUE = "general";

type ExpenseTableColumnKey =
  | "date"
  | "amount"
  | "status"
  | "expenseType"
  | "branch"
  | "employee"
  | "category"
  | "notes"
  | "actions";

type ExpenseFormValues = {
  employeeUserId?: string;
  employeeName?: string;
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
  const { message, modal } = App.useApp();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const defaultBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";

  const [activeTab, setActiveTab] = useState("expenses");
  const initialFilters: ExpenseFilters = useMemo(
    () => ({
      search: "",
      categoryId: "",
      employeeUserId: "",
      status: "all",
      dateRange: [dayjs().startOf("month"), dayjs().endOf("month")],
      minAmount: null,
      maxAmount: null
    }),
    []
  );
  const [filters, setFilters] = useState<ExpenseFilters>(initialFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize, setExpensesPageSize] = useState(10);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [visibleExpenseColumnKeys, setVisibleExpenseColumnKeys] = useState<ExpenseTableColumnKey[]>([
    "date",
    "amount",
    "status",
    "expenseType",
    "branch",
    "employee",
    "category",
    "notes",
    "actions"
  ]);

  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesLoadedOnce, setEmployeesLoadedOnce] = useState(false);
  const [staffUsers, setStaffUsers] = useState<ExpenseEmployeeOption[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<ExpenseCategorySummaryRow[]>([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [expenseLimitReached, setExpenseLimitReached] = useState(false);

  const [expenseDrawerOpen, setExpenseDrawerOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseDrawerDirty, setExpenseDrawerDirty] = useState(false);
  const [returnToExpenseDrawer, setReturnToExpenseDrawer] = useState(false);
  const [newlyCreatedCategoryId, setNewlyCreatedCategoryId] = useState<string | null>(null);
  const [expenseForm] = Form.useForm<ExpenseFormValues>();

  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryDrawerDirty, setCategoryDrawerDirty] = useState(false);
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();

  const watchedCategoryId = Form.useWatch("categoryId", expenseForm);
  const [showEmployeeDetailsToggle, setShowEmployeeDetailsToggle] = useState(false);
  const [listBranchUsersToggle, setListBranchUsersToggle] = useState(false);
  const [mandatoryUserToggle, setMandatoryUserToggle] = useState(false);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === watchedCategoryId) ?? null,
    [categories, watchedCategoryId]
  );
  const showEmployeeSection = selectedCategory?.showEmployeeDetails === true;
  const useBranchUserSelection = selectedCategory?.showEmployeeDetails === true && selectedCategory?.listBranchUsers === true;
  const isEmployeeDetailsMandatory = selectedCategory?.showEmployeeDetails === true && selectedCategory?.mandatory === true;

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const employeeOptions = useMemo(
    () => staffUsers.map((e) => ({ value: e.id, label: `${e.fullName} (${e.role === "manager" ? "Manager" : "Staff"})` })),
    [staffUsers]
  );
  const drawerEmployeeOptions = useMemo(() => {
    if (!editingExpense?.employeeUserId) {
      return employeeOptions;
    }
    const alreadyPresent = employeeOptions.some((option) => option.value === editingExpense.employeeUserId);
    if (alreadyPresent) {
      return employeeOptions;
    }
    return [
      {
        value: editingExpense.employeeUserId,
        label: editingExpense.employeeName?.trim() ? `${editingExpense.employeeName} (Previously selected)` : "Previously selected employee"
      },
      ...employeeOptions
    ];
  }, [employeeOptions, editingExpense]);

  const buildExpenseQueryParams = useCallback(
    (forExport = false) => {
      const params: Record<string, string | number> = {
        startDate: filters.dateRange[0].startOf("day").toISOString(),
        endDate: filters.dateRange[1].startOf("day").toISOString()
      };
      if (!forExport) {
        params.page = expensesPage;
        params.pageSize = expensesPageSize;
      }
      if (defaultBranchId) {
        params.branchId = defaultBranchId;
      }
      if (filters.search.trim()) {
        params.search = filters.search.trim();
      }
      if (filters.categoryId) {
        params.categoryId = filters.categoryId;
      }
      if (filters.employeeUserId) {
        params.employeeUserId = filters.employeeUserId;
      }
      if (filters.minAmount !== null) {
        params.minAmount = filters.minAmount;
      }
      if (filters.maxAmount !== null) {
        params.maxAmount = filters.maxAmount;
      }
      if (filters.status !== "all") {
        params.status = filters.status;
      }
      return params;
    },
    [filters, expensesPage, expensesPageSize, defaultBranchId]
  );

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const { data } = await apiClient.get<ExpenseCategoriesResponse>("/gym/expense-categories");
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
        return data.categories;
      } else {
        setCategories([]);
        return [];
      }
    } catch {
      setCategories([]);
      return [];
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
      const users = Array.isArray(data.staffUsers) ? data.staffUsers : Array.isArray(data.employees) ? data.employees : [];
      if (data.success && users.length >= 0) {
        setStaffUsers(users);
      } else {
        setStaffUsers([]);
      }
    } catch {
      setStaffUsers([]);
    } finally {
      setEmployeesLoadedOnce(true);
      setEmployeesLoading(false);
    }
  }, [defaultBranchId]);

  useEffect(() => {
    setEmployeesLoadedOnce(false);
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

  const loadUsage = useCallback(async () => {
    try {
      const { data } = await apiClient.get<GymUsageSnapshotResponse>("/gym/usage/check");
      setExpenseLimitReached(Boolean(data.limitsReached?.expenses));
    } catch {
      setExpenseLimitReached(false);
    }
  }, []);

  const loadCategorySummary = useCallback(async () => {
    if (filters.status === "deleted") {
      setSummaryRows([]);
      setSummaryTotal(0);
      return;
    }
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
  }, [buildExpenseQueryParams, filters.status, message]);

  useEffect(() => {
    const raw = globalThis.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) {
      setFiltersHydrated(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<ExpenseFilters> & { fromDate?: string; toDate?: string };
      const restored: ExpenseFilters = {
        ...initialFilters,
        ...parsed,
        dateRange:
          parsed.fromDate && parsed.toDate
            ? [dayjs(parsed.fromDate), dayjs(parsed.toDate)]
            : initialFilters.dateRange
      };
      setFilters(restored);
    } catch {
      globalThis.localStorage.removeItem(FILTER_STORAGE_KEY);
    } finally {
      setFiltersHydrated(true);
    }
  }, [initialFilters]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (expenseDrawerOpen && useBranchUserSelection && !employeesLoadedOnce && !employeesLoading) {
      void loadEmployees();
    }
  }, [expenseDrawerOpen, useBranchUserSelection, employeesLoadedOnce, employeesLoading, loadEmployees]);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }
    void loadExpenses();
  }, [loadExpenses, filtersHydrated]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }
    if (filters.status === "deleted") {
      setSummaryRows([]);
      setSummaryTotal(0);
      return;
    }
    void loadCategorySummary();
  }, [loadCategorySummary, filtersHydrated, filters.status]);

  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseDrawerOpen(true);
    setExpenseDrawerDirty(false);
    clearDirty("expenses-expense-drawer");
  };

  const openEditExpense = useCallback((row: ExpenseRow) => {
    setEditingExpense(row);
    setExpenseDrawerOpen(true);
    setExpenseDrawerDirty(false);
    clearDirty("expenses-expense-drawer");
  }, [clearDirty]);

  useEffect(() => {
    if (!expenseDrawerOpen) {
      return;
    }
    if (editingExpense) {
      expenseForm.setFieldsValue({
        employeeUserId:
          editingExpense.employeeUserId ??
          (editingExpense.employeeName?.trim().toLowerCase() === "general" ? GENERAL_EMPLOYEE_OPTION_VALUE : undefined),
        employeeName: editingExpense.employeeUserId ? undefined : (editingExpense.employeeName ?? undefined),
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
      employeeUserId: undefined,
      employeeName: undefined,
      categoryId: newlyCreatedCategoryId ?? undefined,
      notes: undefined
    });
  }, [expenseDrawerOpen, editingExpense, expenseForm, defaultBranchId, newlyCreatedCategoryId]);

  useEffect(() => {
    if (!expenseDrawerOpen) {
      return;
    }
    // Read current category directly from form to avoid watcher timing lag
    // clearing employee values while edit data is hydrating.
    const currentCategoryId = expenseForm.getFieldValue("categoryId");
    if (!currentCategoryId) {
      return;
    }
    const currentCategory = categories.find((category) => category.id === currentCategoryId);
    const currentShowEmployeeSection = currentCategory?.showEmployeeDetails === true;
    const currentUseBranchUserSelection =
      currentCategory?.showEmployeeDetails === true && currentCategory?.listBranchUsers === true;
    if (!currentShowEmployeeSection) {
      expenseForm.setFieldsValue({ employeeUserId: undefined, employeeName: undefined });
      return;
    }
    if (currentUseBranchUserSelection) {
      expenseForm.setFieldsValue({ employeeName: undefined });
      return;
    }
    expenseForm.setFieldsValue({ employeeUserId: undefined });
  }, [expenseDrawerOpen, watchedCategoryId, categories, expenseForm]);

  const submitExpense = async () => {
    try {
      if (!defaultBranchId) {
        message.error("No active branch selected.");
        return;
      }
      const v = await expenseForm.validateFields();
      setExpenseSubmitting(true);
      const selectedEmployeeUserId = v.employeeUserId ?? null;
      const selectedEmployeeName = useBranchUserSelection ? "" : (v.employeeName?.trim() ?? "");
      const payload: Record<string, unknown> = {
        branchId: defaultBranchId,
        employeeUserId: selectedEmployeeUserId,
        employeeName: selectedEmployeeName,
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
          setExpenseDrawerDirty(false);
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
          setExpenseDrawerDirty(false);
          clearDirty("expenses-expense-drawer");
          void loadExpenses();
          void loadCategorySummary();
          void loadUsage();
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

  const deleteExpense = useCallback(async (row: ExpenseRow) => {
    try {
      const { data } = await apiClient.delete<{ success: boolean; message?: string }>(
        `/gym/expenses/${row.id}`
      );
      if (data.success) {
        message.success("Expense deleted.");
        void loadExpenses();
        void loadCategorySummary();
        void loadUsage();
      } else if (data.message) {
        message.error(data.message);
      }
    } catch {
      message.error("Could not delete expense.");
    }
  }, [message, loadExpenses, loadCategorySummary, loadUsage]);

  const confirmDeleteExpense = useCallback((row: ExpenseRow) => {
    modal.confirm({
      title: "Delete this expense?",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteExpense(row);
      }
    });
  }, [modal, deleteExpense]);

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryDrawerOpen(true);
    setCategoryDrawerDirty(false);
    clearDirty("expenses-category-drawer");
  };

  const openAddCategoryFromExpenseDrawer = () => {
    setReturnToExpenseDrawer(true);
    setExpenseDrawerOpen(false);
    setExpenseDrawerDirty(false);
    clearDirty("expenses-expense-drawer");
    setEditingCategory(null);
    setCategoryDrawerOpen(true);
    setCategoryDrawerDirty(false);
    clearDirty("expenses-category-drawer");
  };

  const openEditCategory = (row: ExpenseCategory) => {
    setEditingCategory(row);
    setCategoryDrawerOpen(true);
    setCategoryDrawerDirty(false);
    clearDirty("expenses-category-drawer");
  };

  useEffect(() => {
    if (!categoryDrawerOpen) {
      return;
    }
    if (editingCategory) {
      categoryForm.setFieldsValue({
        name: editingCategory.name,
        description: editingCategory.description
      });
      setShowEmployeeDetailsToggle(editingCategory.showEmployeeDetails === true);
      setListBranchUsersToggle(editingCategory.listBranchUsers === true);
      setMandatoryUserToggle(editingCategory.mandatory === true);
      return;
    }
    categoryForm.setFieldsValue({
      name: "",
      description: ""
    });
    setShowEmployeeDetailsToggle(false);
    setListBranchUsersToggle(false);
    setMandatoryUserToggle(false);
  }, [categoryDrawerOpen, editingCategory, categoryForm]);

  const submitCategory = async () => {
    try {
      await categoryForm.validateFields();
      const formValues = categoryForm.getFieldsValue(true) as CategoryFormValues;
      const payload = {
        name: formValues.name,
        description: formValues.description ?? "",
        showEmployeeDetails: showEmployeeDetailsToggle === true,
        listBranchUsers: showEmployeeDetailsToggle === true && listBranchUsersToggle === true,
        mandatory: showEmployeeDetailsToggle === true && mandatoryUserToggle === true
      };
      setCategorySubmitting(true);
      if (editingCategory) {
        const { data } = await apiClient.patch<ExpenseMutationResponse>(
          `/gym/expense-categories/${editingCategory.id}`,
          payload
        );
        if (data.success) {
          if (data.category) {
            setCategories((prev) => prev.map((item) => (item.id === data.category?.id ? data.category : item)));
          }
          message.success("Category updated.");
          setCategoryDrawerOpen(false);
          setCategoryDrawerDirty(false);
          clearDirty("expenses-category-drawer");
          await loadCategories();
        } else if (data.message) {
          message.error(data.message);
        }
      } else {
        const { data } = await apiClient.post<ExpenseMutationResponse>("/gym/expense-categories", payload);
        if (data.success) {
          if (data.category) {
            const createdCategory = data.category;
            setCategories((prev) => {
              const exists = prev.some((item) => item.id === createdCategory.id);
              if (exists) {
                return prev.map((item) => (item.id === createdCategory.id ? createdCategory : item));
              }
              return [...prev, createdCategory];
            });
          }
          message.success("Category saved.");
          setCategoryDrawerOpen(false);
          setCategoryDrawerDirty(false);
          clearDirty("expenses-category-drawer");
          await loadCategories();
          if (data.category?.id) {
            setNewlyCreatedCategoryId(data.category.id);
          }
          if (returnToExpenseDrawer) {
            setReturnToExpenseDrawer(false);
            setEditingExpense(null);
            setExpenseDrawerOpen(true);
          }
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

  const confirmDeleteCategory = (row: ExpenseCategory) => {
    modal.confirm({
      title: "Delete this category?",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteCategory(row);
      }
    });
  };

  const expenseColumns: ColumnsType<ExpenseRow> = useMemo(
    () => [
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
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status: ExpenseRow["status"]) => (
          <Tag color={status === "deleted" ? "red" : "green"}>{status === "deleted" ? "Deleted" : "Success"}</Tag>
        )
      },
      {
        title: "Expense Type",
        key: "expenseType",
        render: (_, row) => row.categoryName ?? row.expenseTypeLabel ?? "Category"
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
        fixed: "right",
        render: (_, row) => (
          <Space>
            {row.status === "deleted" ? (
              <Text type="secondary">—</Text>
            ) : (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="Edit expense"
                  onClick={() => openEditExpense(row)}
                />
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Delete expense"
                  onClick={() => confirmDeleteExpense(row)}
                />
              </>
            )}
          </Space>
        )
      }
    ],
    [openEditExpense, confirmDeleteExpense]
  );

  const visibleExpenseColumns = useMemo(
    () =>
      expenseColumns.filter((column) => {
        const key = String(column.key ?? "") as ExpenseTableColumnKey;
        return visibleExpenseColumnKeys.includes(key);
      }),
    [expenseColumns, visibleExpenseColumnKeys]
  );

  const expenseColumnOptions: Array<{ label: string; value: ExpenseTableColumnKey }> = useMemo(
    () => [
      { label: "Date", value: "date" },
      { label: "Amount", value: "amount" },
      { label: "Status", value: "status" },
      { label: "Expense Type", value: "expenseType" },
      { label: "Branch", value: "branch" },
      { label: "Employee", value: "employee" },
      { label: "Category", value: "category" },
      { label: "Notes / Description", value: "notes" },
      { label: "Actions", value: "actions" }
    ],
    []
  );

  const categoryColumns: ColumnsType<ExpenseCategory> = [
    { title: "Category Name", dataIndex: "name", key: "name" },
    {
      title: "Employee details",
      key: "employeeSettings",
      render: (_, row) =>
        row.showEmployeeDetails ? `Enabled${row.mandatory ? " • Mandatory" : ""}${row.listBranchUsers ? " • Branch users" : ""}` : "Disabled"
    },
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
          <Button type="link" size="small" danger onClick={() => confirmDeleteCategory(row)}>
            Delete
          </Button>
        </Space>
      )
    }
  ];

  const filterableEmployeeOptions = useMemo(() => employeeOptions, [employeeOptions]);

  useEffect(() => {
    if (!filterOpen || employeesLoading || employeesLoadedOnce) {
      return;
    }
    void loadEmployees();
  }, [filterOpen, employeesLoading, employeesLoadedOnce, loadEmployees]);

  const countActiveFilters = useCallback((value: ExpenseFilters) => {
    let count = 0;
    if (value.search.trim()) {
      count += 1;
    }
    if (value.categoryId) {
      count += 1;
    }
    if (value.employeeUserId) {
      count += 1;
    }
    if (value.minAmount !== null || value.maxAmount !== null) {
      count += 1;
    }
    if (value.status !== "all") {
      count += 1;
    }
    if (value.dateRange?.[0] || value.dateRange?.[1]) {
      count += 1;
    }
    return count;
  }, []);

  useEffect(() => {
    setActiveFilters(countActiveFilters(filters));
  }, [filters, countActiveFilters]);

  const applyFilters = (nextFilters: ExpenseFilters) => {
    setFilters(nextFilters);
    setExpensesPage(1);
    setFilterOpen(false);
    globalThis.localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        ...nextFilters,
        fromDate: nextFilters.dateRange[0].toISOString(),
        toDate: nextFilters.dateRange[1].toISOString()
      })
    );
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setExpensesPage(1);
    setFilterOpen(false);
    globalThis.localStorage.removeItem(FILTER_STORAGE_KEY);
  };

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
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16
                  }}
                >
                  <Space wrap>
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
                            value={visibleExpenseColumnKeys}
                            onChange={(checked) => {
                              const next = checked.map((value) => String(value) as ExpenseTableColumnKey);
                              if (next.length === 0) {
                                return;
                              }
                              setVisibleExpenseColumnKeys(next);
                            }}
                          >
                            {expenseColumnOptions.map((option) => (
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
                    <Button
                      icon={<FilterOutlined />}
                      type="default"
                      onClick={() => setFilterOpen(true)}
                    >
                      Filters
                      {activeFilters > 0 ? (
                        <span
                          style={{
                            marginLeft: 8,
                            backgroundColor: "#1677ff",
                            color: "#fff",
                            borderRadius: "50%",
                            padding: "2px 6px",
                            fontSize: 12,
                            minWidth: 16,
                            display: "inline-block",
                            textAlign: "center"
                          }}
                        >
                          {activeFilters}
                        </span>
                      ) : null}
                    </Button>
                    <ExportButton
                      endpoint="/gym/exports/expenses"
                      params={buildExpenseQueryParams(true)}
                      defaultFilename="expenses.csv"
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openAddExpense}
                      disabled={expenseLimitReached}
                      title={expenseLimitReached ? "Expense limit reached. Upgrade plan to add more expenses." : undefined}
                    >
                      Add expense
                    </Button>
                  </Space>
                </div>
                <div style={{ marginBottom: 16 }}>
                  {filters.status !== "deleted" ? (
                    <>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 10,
                          gap: 12
                        }}
                      >
                        <Text strong>Expense-head overview</Text>
                        <Text strong>Total: {formatInr(summaryTotal)}</Text>
                      </div>
                      {summaryLoading ? (
                        <Text type="secondary">Loading overview...</Text>
                      ) : summaryRows.length === 0 ? (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <span>
                              <div>No category totals for selected period</div>
                              <Text type="secondary">Add expenses to see category-wise totals.</Text>
                            </span>
                          }
                        />
                      ) : (
                        <div
                          style={{
                            maxHeight: 248,
                            overflowY: "auto",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                            gap: 12,
                            paddingRight: 4
                          }}
                        >
                          {summaryRows.map((row) => (
                            <div
                              key={row.categoryId ?? "uncategorized"}
                              style={{
                                border: `1px solid ${token.colorBorderSecondary}`,
                                borderRadius: 10,
                                padding: 10,
                                background: token.colorBgContainer,
                                minHeight: 108
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <Text strong ellipsis={{ tooltip: row.categoryName }}>
                                  {row.categoryName}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                                  {row.expenseCount}
                                </Text>
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                                  Total Amount
                                </Text>
                                <Text style={{ fontWeight: 600 }}>{formatInr(row.totalAmount)}</Text>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
                <Table<ExpenseRow>
                  rowKey="id"
                  loading={expensesLoading}
                  columns={visibleExpenseColumns}
                  dataSource={expenses}
                  pagination={{
                    current: expensesPage,
                    pageSize: expensesPageSize,
                    total: expensesTotal,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ["10", "25", "50", "100"],
                    size: "small",
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
                  scroll={{ x: 1100, y: "calc(100vh - 120px)" }}
                  tableLayout="fixed"
                />
              </>
            )
          },
          {
            key: "categories",
            label: "Categories",
            children: (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 12 }}>
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
                  scroll={{ x: 760, y: "calc(100vh - 120px)" }}
                  tableLayout="fixed"
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
            setExpenseDrawerDirty(false);
            clearDirty("expenses-expense-drawer");
          };
          if (expenseDrawerDirty) {
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
                  setExpenseDrawerDirty(false);
                  clearDirty("expenses-expense-drawer");
                };
                if (expenseDrawerDirty) {
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
            setExpenseDrawerDirty(true);
            setDirty("expenses-expense-drawer", true);
          }}
        >
          <Form.Item
            name="categoryId"
            label="Category"
            rules={[{ required: true, message: "Select category" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={categories.length ? "Select category" : "No categories available"}
              options={categoryOptions}
              loading={categoriesLoading}
              popupRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: 8 }}>
                    <Button type="link" icon={<PlusOutlined />} onClick={openAddCategoryFromExpenseDrawer}>
                      Add category
                    </Button>
                  </div>
                </>
              )}
            />
          </Form.Item>
          {showEmployeeSection ? (
            useBranchUserSelection ? (
              <Form.Item
                name="employeeUserId"
                label="Select staff/manager"
                rules={isEmployeeDetailsMandatory ? [{ required: true, message: "Select staff/manager" }] : undefined}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={[
                    { value: GENERAL_EMPLOYEE_OPTION_VALUE, label: "General (Temporary / Dummy)" },
                    ...drawerEmployeeOptions
                  ]}
                  loading={employeesLoading}
                  placeholder={employeeOptions.length ? "Select staff/manager" : "No staff/manager found for this branch"}
                />
              </Form.Item>
            ) : (
              <Form.Item
                name="employeeName"
                label="Employee / Person"
                rules={isEmployeeDetailsMandatory ? [{ required: true, message: "Enter employee/person name" }] : undefined}
              >
                <Input placeholder="Type name (e.g. Guest trainer, Cleaner, etc.)" />
              </Form.Item>
            )
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
            setCategoryDrawerDirty(false);
            clearDirty("expenses-category-drawer");
          };
          if (categoryDrawerDirty) {
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
                  setCategoryDrawerDirty(false);
                  clearDirty("expenses-category-drawer");
                };
                if (categoryDrawerDirty) {
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
            setCategoryDrawerDirty(true);
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
          <Form.Item style={{ marginBottom: 12 }}>
            <Space size={16} wrap>
              <Checkbox
                checked={showEmployeeDetailsToggle}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setShowEmployeeDetailsToggle(checked);
                  setCategoryDrawerDirty(true);
                  setDirty("expenses-category-drawer", true);
                  if (!checked) {
                    setListBranchUsersToggle(false);
                    setMandatoryUserToggle(false);
                  }
                }}
              >
                Show employees details
              </Checkbox>
              <Checkbox
                checked={listBranchUsersToggle}
                disabled={!showEmployeeDetailsToggle}
                onChange={(event) => {
                  setListBranchUsersToggle(event.target.checked);
                  setCategoryDrawerDirty(true);
                  setDirty("expenses-category-drawer", true);
                }}
              >
                List users of current branch
              </Checkbox>
              <Checkbox
                checked={mandatoryUserToggle}
                disabled={!showEmployeeDetailsToggle}
                onChange={(event) => {
                  setMandatoryUserToggle(event.target.checked);
                  setCategoryDrawerDirty(true);
                  setDirty("expenses-category-drawer", true);
                }}
              >
                Mandatory user field
              </Checkbox>
            </Space>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={4} placeholder="Enter category description" />
          </Form.Item>
        </Form>
      </Drawer>

      <ExpensesFilterModal
        open={filterOpen}
        currentFilters={filters}
        categories={categories}
        employeeOptions={filterableEmployeeOptions}
        employeesLoading={employeesLoading}
        onClose={() => setFilterOpen(false)}
        onApply={applyFilters}
        onClear={clearFilters}
      />
    </div>
  );
}
