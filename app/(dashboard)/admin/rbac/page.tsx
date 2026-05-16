"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Checkbox, Col, Divider, Row, Space, Tabs, Tag, Typography } from "antd";
import apiClient from "@/utils/api";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";
import {
  registryBySection,
  registryForRoleMaster,
  type ModuleKey,
  type ModuleRegistryEntry,
  type ModuleSection,
  type PermissionAction,
  type RolePermissionMap
} from "@/constants/permissionSchema";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import {
  selectRbacConfig,
  setAllRolePermissions,
  setRbacConfig,
  toggleModulePermission,
  toggleModuleView,
  toggleRbacSettingsForManager
} from "@/redux/features/rbacSlice";
import { gymMembershipRoleFromSession } from "@/utils/gymRole";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

type PermissionsResponse = {
  success: boolean;
  owner?: RolePermissionMap;
  manager?: RolePermissionMap;
  staff?: RolePermissionMap;
  message?: string;
};

function toTitle(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const ACTION_LABELS: Record<Exclude<PermissionAction, "view">, string> = {
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  import: "Import members",
  export: "Export",
  new_membership: "New membership",
  overdue_payment: "Add overdue payment",
  cancel_membership: "Cancel membership"
};

function countEnabledPermissions(map: RolePermissionMap): number {
  let count = 0;
  for (const entry of registryForRoleMaster()) {
    const perm = map[entry.key];
    if (!perm) {
      continue;
    }
    for (const action of entry.actions) {
      if (perm[action]) {
        count += 1;
      }
    }
  }
  return count;
}

function isModuleViewOn(map: RolePermissionMap, module: ModuleKey): boolean {
  return map[module]?.view === true;
}

function isModuleActionOn(map: RolePermissionMap, module: ModuleKey, action: PermissionAction): boolean {
  return map[module]?.[action] === true;
}

export default function RbacAdminPage() {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectRbacConfig);
  const session = useAppSelector(selectSession);
  const messageRef = useRef(message);
  const [activeRole, setActiveRole] = useState<"manager" | "staff">("staff");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageDirty, setPageDirty] = useState(false);
  const ownerDefaultTabAppliedRef = useRef(false);
  const currentUserRole = gymMembershipRoleFromSession(session);
  const canEditManagerRole = currentUserRole === "owner";
  const { setDirty, clearDirty, confirmNavigation } = useUnsavedChanges();

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PermissionsResponse>("/admin/rbac/permissions");
      if (!data.success) {
        messageRef.current.error(data.message ?? "Could not load permissions.");
        return;
      }
      dispatch(
        setRbacConfig({
          owner: data.owner ?? {},
          manager: data.manager ?? {},
          staff: data.staff ?? {}
        })
      );
      setPageDirty(false);
      clearDirty("rbac-page");
    } catch {
      messageRef.current.error("Could not load permissions.");
    } finally {
      setLoading(false);
    }
  }, [dispatch, clearDirty]);

  const rolePermissions = config[activeRole];
  const sectionMap = useMemo(() => registryBySection(), []);
  const standardSections = useMemo(
    () =>
      [...sectionMap.entries()].filter(([section]) => section !== "admin_only") as Array<
        [ModuleSection, ModuleRegistryEntry[]]
      >,
    [sectionMap]
  );

  const enabledCount = useMemo(() => countEnabledPermissions(rolePermissions), [rolePermissions]);

  const markDirty = () => {
    setPageDirty(true);
    setDirty("rbac-page", true);
  };

  const setAll = (checked: boolean) => {
    dispatch(setAllRolePermissions({ role: activeRole, enabled: checked }));
    markDirty();
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        owner: config.owner,
        manager: config.manager,
        staff: config.staff
      };
      const { data } = await apiClient.put<PermissionsResponse>("/admin/rbac/permissions", payload);
      if (!data.success) {
        message.error(data.message ?? "Could not save permissions.");
        return;
      }
      dispatch(
        setRbacConfig({
          owner: data.owner ?? payload.owner,
          manager: data.manager ?? payload.manager,
          staff: data.staff ?? payload.staff
        })
      );
      setPageDirty(false);
      clearDirty("rbac-page");
      message.success("Permissions saved. Staff and managers must log out and back in for changes to apply.");
    } catch {
      message.error("Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const requestRoleChange = (nextRole: "manager" | "staff") => {
    if (nextRole === activeRole) {
      return;
    }
    if (!pageDirty) {
      setActiveRole(nextRole);
      return;
    }
    confirmNavigation(() => setActiveRole(nextRole));
  };

  const renderCrudModule = (entry: ModuleRegistryEntry) => {
    const viewChecked = isModuleViewOn(rolePermissions, entry.key);
    const actions: Array<Exclude<PermissionAction, "view">> = entry.actions.filter(
      (a): a is Exclude<PermissionAction, "view"> => a !== "view"
    );
    return (
      <div key={entry.key} style={{ width: "100%" }}>
        <Row justify="space-between" align="middle" wrap={false}>
          <Col flex="auto">
            <Checkbox
              checked={viewChecked}
              disabled={loading || saving}
              onChange={(event) => {
                dispatch(
                  toggleModuleView({
                    role: activeRole,
                    module: entry.key,
                    checked: event.target.checked
                  })
                );
                markDirty();
              }}
            >
              <Typography.Text strong>{entry.label}</Typography.Text>
              <Typography.Text type="secondary"> — View (list &amp; details)</Typography.Text>
            </Checkbox>
          </Col>
          <Col>
            <Tag color={viewChecked ? "green" : "default"}>{viewChecked ? "View on" : "Off"}</Tag>
          </Col>
        </Row>
        {actions.length > 0 ? (
          <div style={{ marginLeft: 28, marginTop: 8 }}>
            <Space size={16} wrap>
              {actions.map((action) => {
                const checked = isModuleActionOn(rolePermissions, entry.key, action);
                return (
                  <Checkbox
                    key={action}
                    checked={checked}
                    disabled={!viewChecked || loading || saving}
                    onChange={(event) => {
                      dispatch(
                        toggleModulePermission({
                          role: activeRole,
                          module: entry.key,
                          action,
                          checked: event.target.checked
                        })
                      );
                      markDirty();
                    }}
                  >
                    {ACTION_LABELS[action]}
                  </Checkbox>
                );
              })}
            </Space>
          </div>
        ) : null}
      </div>
    );
  };

  const renderViewOnlyModule = (entry: ModuleRegistryEntry) => {
    const checked = isModuleViewOn(rolePermissions, entry.key);
    return (
      <Row key={entry.key} justify="space-between" align="middle" wrap={false}>
        <Col flex="auto">
          <Checkbox
            checked={checked}
            disabled={loading || saving}
            onChange={(event) => {
              dispatch(
                toggleModuleView({
                  role: activeRole,
                  module: entry.key,
                  checked: event.target.checked
                })
              );
              markDirty();
            }}
          >
            {entry.label}
          </Checkbox>
        </Col>
        <Col>
          <Tag color={checked ? "green" : "default"}>{checked ? "Allowed" : "Blocked"}</Tag>
        </Col>
      </Row>
    );
  };

  const renderSection = (section: ModuleSection, modules: ModuleRegistryEntry[]) => {
    if (modules.length === 0) {
      return null;
    }
    const crudModules = modules.filter((m) => m.actions.length > 1);
    const viewOnlyModules = modules.filter((m) => m.actions.length === 1);
    return (
      <Card key={section} size="small" title={toTitle(section)} style={{ width: "100%", height: "100%" }}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {crudModules.map((entry) => renderCrudModule(entry))}
          {crudModules.length > 0 && viewOnlyModules.length > 0 ? <Divider style={{ margin: "4px 0" }} /> : null}
          {viewOnlyModules.map((entry) => renderViewOnlyModule(entry))}
        </Space>
      </Card>
    );
  };

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    if (canEditManagerRole && currentUserRole === "owner" && !ownerDefaultTabAppliedRef.current) {
      ownerDefaultTabAppliedRef.current = true;
      setActiveRole("manager");
      return;
    }
    if (!canEditManagerRole && activeRole === "manager") {
      setActiveRole("staff");
    }
  }, [activeRole, canEditManagerRole, currentUserRole]);

  useEffect(() => {
    return () => {
      clearDirty("rbac-page");
    };
  }, [clearDirty]);

  const managerRbacOn = config.manager.rbac_settings?.view === true;

  return (
    <RbacPermissionGuard permission={FEATURES.RBAC_SETTINGS}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Tabs
          activeKey={activeRole}
          onChange={(value) => requestRoleChange(value as "manager" | "staff")}
          items={
            canEditManagerRole
              ? [
                  { key: "manager", label: "Manager" },
                  { key: "staff", label: "Staff" }
                ]
              : [{ key: "staff", label: "Staff" }]
          }
        />

        <Row justify="space-between" align="middle" wrap gutter={[12, 12]}>
          <Col>
            <Space size={8} wrap>
              <Typography.Text type="secondary">Bulk:</Typography.Text>
              <Button size="small" onClick={() => setAll(true)} disabled={loading || saving}>
                Select all
              </Button>
              <Button size="small" onClick={() => setAll(false)} disabled={loading || saving}>
                Deselect all
              </Button>
              <Typography.Text type="secondary">{enabledCount} permissions enabled</Typography.Text>
            </Space>
          </Col>
          <Col>
            <Button type="primary" loading={saving} onClick={() => void save()}>
              Save Access
            </Button>
          </Col>
        </Row>

        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <strong>View</strong> shows the module in navigation and pages. <strong>Create</strong>, <strong>Edit</strong>
          , and <strong>Delete</strong> control those actions. Members permissions include assigning and cancelling
          memberships. <strong>Transactions → View</strong> allows the transactions page and member payment history in
          member profiles. Membership Plans automatically includes Packages (hidden).
        </Typography.Paragraph>

        {canEditManagerRole && activeRole === "manager" ? (
          <Card size="small" title="Role Master Access">
            <Row justify="space-between" align="middle" wrap={false}>
              <Col flex="auto">
                <Checkbox
                  checked={managerRbacOn}
                  disabled={loading || saving}
                  onChange={(event) => {
                    dispatch(toggleRbacSettingsForManager({ checked: event.target.checked }));
                    markDirty();
                  }}
                >
                  Allow manager to access Role Master page
                </Checkbox>
              </Col>
              <Col>
                <Tag color={managerRbacOn ? "green" : "default"}>{managerRbacOn ? "Allowed" : "Blocked"}</Tag>
              </Col>
            </Row>
          </Card>
        ) : null}

        <Row gutter={[16, 16]}>
          {standardSections.map(([section, modules]) => (
            <Col key={section} xs={24} md={12} style={{ display: "flex" }}>
              {renderSection(section, modules)}
            </Col>
          ))}
        </Row>
      </Space>
    </RbacPermissionGuard>
  );
}

