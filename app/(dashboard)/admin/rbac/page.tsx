"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Checkbox, Col, Divider, Row, Space, Tabs, Tag, Typography } from "antd";
import apiClient from "@/utils/api";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";
import { FEATURE_MAP, type FeatureKey } from "@/constants/featureMap";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  selectRbacConfig,
  setRbacConfig,
  setRoleFeatures,
  toggleRoleFeature
} from "@/redux/features/rbacSlice";

type PermissionsResponse = {
  success: boolean;
  owner?: FeatureKey[];
  manager?: FeatureKey[];
  staff?: FeatureKey[];
  message?: string;
};

function toTitle(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RbacAdminPage() {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const config = useAppSelector(selectRbacConfig);
  const messageRef = useRef(message);
  const [activeRole, setActiveRole] = useState<"owner" | "manager" | "staff">("owner");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
          owner: (data.owner ?? []) as FeatureKey[],
          manager: (data.manager ?? []) as FeatureKey[],
          staff: (data.staff ?? []) as FeatureKey[]
        })
      );
    } catch {
      messageRef.current.error("Could not load permissions.");
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const roleFeatures = config[activeRole];
  const sections = useMemo(
    () =>
      Object.entries(FEATURE_MAP).map(([section, features]) => ({
        section: section as keyof typeof FEATURE_MAP,
        features: [...features]
      })),
    []
  );
  const standardSections = useMemo(
    () => sections.filter((entry) => entry.section !== "admin_only"),
    [sections]
  );
  const maxSectionFeatures = useMemo(
    () => Math.max(...standardSections.map((entry) => entry.features.length), 1),
    [standardSections]
  );
  const cardMinHeight = useMemo(() => 140 + maxSectionFeatures * 40, [maxSectionFeatures]);

  const isLocked = useCallback(
    (feature: FeatureKey) => {
      if (activeRole !== "owner" && (FEATURE_MAP.admin_only as readonly string[]).includes(feature)) {
        return true;
      }
      return activeRole === "owner" && feature === "rbac_settings";
    },
    [activeRole]
  );

  const editableFeatures = useMemo(
    () =>
      sections
        .flatMap((entry) => entry.features)
        .filter((feature) => !isLocked(feature)),
    [isLocked, sections]
  );

  const enabledCount = editableFeatures.filter((feature) => roleFeatures.includes(feature)).length;

  const setAll = (checked: boolean) => {
    const next = checked ? [...new Set([...roleFeatures, ...editableFeatures])] : roleFeatures.filter((feature) => isLocked(feature));
    dispatch(setRoleFeatures({ role: activeRole, features: next }));
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
          owner: (data.owner ?? payload.owner) as FeatureKey[],
          manager: (data.manager ?? payload.manager) as FeatureKey[],
          staff: (data.staff ?? payload.staff) as FeatureKey[]
        })
      );
      message.success("Permissions saved.");
    } catch {
      message.error("Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (section: keyof typeof FEATURE_MAP, features: FeatureKey[]) => (
    <Card
      key={section}
      size="small"
      title={toTitle(section)}
      style={{ width: "100%", height: "100%", minHeight: cardMinHeight }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        {features.map((feature) => {
          const checked = roleFeatures.includes(feature);
          const disabled = isLocked(feature);
          return (
            <Row key={feature} justify="space-between" align="middle" wrap={false}>
              <Col flex="auto">
                <Checkbox
                  checked={checked}
                  disabled={disabled || loading || saving}
                  onChange={(event) =>
                    dispatch(
                      toggleRoleFeature({
                        role: activeRole,
                        feature,
                        checked: event.target.checked
                      })
                    )
                  }
                >
                  {toTitle(feature)}
                </Checkbox>
              </Col>
              <Col>
                <Tag color={checked ? "green" : "default"}>{checked ? "Allowed" : "Blocked"}</Tag>
              </Col>
            </Row>
          );
        })}
      </Space>
    </Card>
  );

  useEffect(() => {
    void loadPermissions();
  }, [loadPermissions]);

  return (
    <RbacPermissionGuard permission={FEATURES.RBAC_SETTINGS} requireOwner>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Tabs
          activeKey={activeRole}
          onChange={(value) => setActiveRole(value as "owner" | "manager" | "staff")}
          items={[
            { key: "owner", label: "Owner" },
            { key: "manager", label: "Manager" },
            { key: "staff", label: "Staff" }
          ]}
        />

        <Space size={8}>
          <Typography.Text type="secondary">Bulk:</Typography.Text>
          <Button size="small" onClick={() => setAll(true)} disabled={loading || saving}>
            Select all
          </Button>
          <Button size="small" onClick={() => setAll(false)} disabled={loading || saving}>
            Deselect all
          </Button>
          <Typography.Text type="secondary">
            {enabledCount} / {editableFeatures.length} screens enabled
          </Typography.Text>
        </Space>

        <Row gutter={[16, 16]}>
          {standardSections.map((entry) => (
            <Col key={entry.section} xs={24} md={12} style={{ display: "flex" }}>
              {renderSection(entry.section, entry.features)}
            </Col>
          ))}
        </Row>

        <Row gutter={[32, 16]}>
          <Col xs={24}>
            <Card size="small" title="Admin Only" style={{ width: "100%" }}>
              <Typography.Text type="secondary">
                These screens are permanently restricted to admins and cannot be granted to manager/staff.
              </Typography.Text>
              <Divider style={{ margin: "12px 0" }} />
              <Row gutter={[32, 16]}>
                {FEATURE_MAP.admin_only.map((feature) => {
                  const checked = roleFeatures.includes(feature);
                  const ownerEditable = activeRole === "owner" && feature !== "rbac_settings";
                  const disabled = !ownerEditable || loading || saving;
                  return (
                    <Col key={feature} xs={24} md={12}>
                      <Row justify="space-between" align="middle" wrap={false}>
                        <Col flex="auto">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) =>
                              dispatch(
                                toggleRoleFeature({
                                  role: activeRole,
                                  feature,
                                  checked: event.target.checked
                                })
                              )
                            }
                          >
                            {toTitle(feature)}
                          </Checkbox>
                        </Col>
                        <Col>
                          <Tag color={activeRole === "owner" ? "red" : "default"}>
                            {activeRole === "owner" ? "Admin only" : "Blocked"}
                          </Tag>
                        </Col>
                      </Row>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          </Col>
        </Row>

        <Button type="primary" loading={saving} onClick={() => void save()}>
          Save Access
        </Button>
      </Space>
    </RbacPermissionGuard>
  );
}
