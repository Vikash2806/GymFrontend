"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  App,
  Layout,
  Typography,
  Avatar,
  Button,
  Space,
  Dropdown,
  theme,
  type MenuProps,
  Select,
  Flex
} from "antd";
import {
  DownOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  ShopOutlined
} from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  logoutAsync,
  selectSession,
  setSession
} from "@/redux/features/auth/authSlice";
import { usePathname, useRouter } from "next/navigation";
import apiClient from "@/utils/api";
import type { SessionGymBranch, SessionPayload } from "@/redux/features/auth/sessionTypes";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

const { Header } = Layout;
const { Text } = Typography;

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function branchInitials(name: string, code: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase().slice(0, 2);
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const alnum = (code || "BR").replace(/[^a-z0-9]/gi, "");
  if (alnum.length >= 2) {
    return alnum.slice(0, 2).toUpperCase();
  }
  return "BR";
}

function BranchAvatar({ branch, size = 22 }: { branch: SessionGymBranch; size?: number }) {
  const hue = hashHue(branch.id);
  return (
    <Avatar
      size={size}
      style={{
        flexShrink: 0,
        background: `linear-gradient(145deg, hsl(${hue}, 48%, 52%), hsl(${(hue + 28) % 360}, 42%, 44%))`,
        color: "#fff",
        fontSize: size <= 20 ? 10 : 11,
        fontWeight: 600,
        lineHeight: 1,
        boxShadow: "0 1px 2px rgba(0,0,0,0.12)"
      }}
    >
      {branchInitials(branch.name, branch.code)}
    </Avatar>
  );
}

interface CustomAppBarProps {
  onHeightChange: (height: number) => void;
}

async function refreshSession(dispatch: ReturnType<typeof useAppDispatch>) {
  const { data } = await apiClient.get<SessionPayload>("/auth/me");
  dispatch(setSession(data));
}

export default function CustomAppBar({ onHeightChange }: CustomAppBarProps) {
  const { message } = App.useApp();
  const headerRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { confirmNavigation } = useUnsavedChanges();

  const gym = session?.gym;
  const activeBranch = session?.activeBranch;
  const branches = gym?.branches;
  const gymId = session?.user?.defaults?.gymId ?? gym?.id ?? "";
  const membership = session?.user?.associatedGyms?.find((g) => g.gymId === gymId);
  const canOpenSettings = hasFeature(session, FEATURES.SETTINGS);
  const userRole = String(session?.rbac?.role ?? membership?.gymRole ?? "").toLowerCase();
  const isOwner = userRole === "owner";
  const assignedBranchIds = useMemo(() => {
    const allBranches = branches ?? [];
    if (isOwner) {
      return allBranches.map((branch) => branch.id);
    }
    const fromMembership = (membership?.branches ?? []).map((entry) => entry.branchId);
    if (fromMembership.length > 0) {
      return [...new Set(fromMembership)];
    }
    const fallback = session?.user?.defaults?.branchId ?? activeBranch?.id ?? "";
    return fallback ? [fallback] : [];
  }, [isOwner, branches, membership?.branches, session?.user?.defaults?.branchId, activeBranch?.id]);
  const visibleBranches = useMemo(
    () => (branches ?? []).filter((branch) => assignedBranchIds.includes(branch.id)),
    [branches, assignedBranchIds]
  );
  const selectedBranchId = useMemo(() => {
    const activeId = activeBranch?.id ?? "";
    if (activeId && visibleBranches.some((branch) => branch.id === activeId)) {
      return activeId;
    }
    return visibleBranches[0]?.id;
  }, [activeBranch?.id, visibleBranches]);
  const workspaceLabel = useMemo(() => {
    if (userRole === "owner") {
      return "Gym owner workspace";
    }
    if (userRole === "manager") {
      return "Gym manager workspace";
    }
    if (userRole === "staff") {
      return "Gym staff workspace";
    }
    return gym ? "Gym workspace" : "Gym management workspace";
  }, [userRole, gym]);
  const roleLabel = useMemo(() => {
    if (userRole === "owner") {
      return "Owner";
    }
    if (userRole === "manager") {
      return "Manager";
    }
    if (userRole === "staff") {
      return "Staff";
    }
    return "Unknown";
  }, [userRole]);

  useEffect(() => {
    if (headerRef.current) {
      onHeightChange(headerRef.current.clientHeight);
    }
  }, [onHeightChange]);

  const onProfileMenuClick: MenuProps["onClick"] = async ({ key }) => {
    if (key === "settings") {
      if (!canOpenSettings) {
        return;
      }
      if (pathname !== "/pages/settings") {
        confirmNavigation(() => router.push("/pages/settings"));
      }
      return;
    }
    if (key === "logout") {
      confirmNavigation(() => {
        void (async () => {
          await dispatch(logoutAsync());
          router.push("/login");
        })();
      });
    }
  };

  const profileMenuItems: MenuProps["items"] = [
    {
      key: "role",
      label: `Role: ${roleLabel}`,
      disabled: true
    },
    { type: "divider" },
    ...(canOpenSettings ? [{ key: "settings", label: "Settings", icon: <SettingOutlined /> }] : []),
    { key: "logout", label: "Logout", icon: <LogoutOutlined /> }
  ];

  const displayName = gym?.name ?? "Gym Admin";
  const initials =
    session?.user?.fullName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  const onBranchChange = async (branchId: string) => {
    try {
      await apiClient.patch("/auth/branch", { branchId });
      await refreshSession(dispatch);
    } catch {
      message.error("Could not switch branch.");
    }
  };

  const renderGymLogo = (size: number) => {
    const url = gym?.logoUrl;
    if (url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={size} height={size} style={{ borderRadius: 8, objectFit: "cover" }} />
      );
    }
    return (
      <Avatar shape="square" size={size} style={{ backgroundColor: token.colorPrimary }}>
        <ShopOutlined />
      </Avatar>
    );
  };

  return (
    <Header
      ref={headerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: token.colorBgElevated,
        height: "auto",
        minHeight: 64,
        padding: "10px 16px",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${token.colorBorder}`,
        lineHeight: 1.3
      }}
    >
      <Flex align="flex-start" gap={12} style={{ minWidth: 0, flex: "0 1 auto" }}>
        <Flex style={{ paddingTop: 2 }}>{gym ? renderGymLogo(38) : (
          <Avatar shape="square" size={38} style={{ backgroundColor: token.colorPrimary }}>
            <ShopOutlined />
          </Avatar>
        )}</Flex>

        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Flex align="center" wrap={false} gap={8} style={{ minWidth: 0 }}>
            <Text
              strong
              ellipsis
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: token.colorPrimary,
                lineHeight: "24px",
                flex: "0 1 auto",
                maxWidth: 220
              }}
            >
              {displayName}
            </Text>
            {visibleBranches.length > 0 && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 32,
                  maxWidth: 220,
                  minWidth: 148,
                  padding: "0 4px 0 6px",
                  borderRadius: 8,
                  background: token.colorFillQuaternary,
                  border: "none",
                  flex: "0 1 auto"
                }}
              >
                <Select
                  variant="borderless"
                  value={selectedBranchId}
                  options={visibleBranches.map((b) => ({ value: b.id, label: b.name }))}
                  onChange={onBranchChange}
                  disabled={visibleBranches.length <= 1}
                  optionRender={(opt) => {
                    const b = visibleBranches.find((x) => x.id === opt.value);
                    if (!b) {
                      return <span>{opt.label}</span>;
                    }
                    return (
                      <Flex align="center" gap={10} style={{ padding: "6px 4px", minWidth: 0 }}>
                        <BranchAvatar branch={b} size={28} />
                        <Flex vertical gap={0} style={{ minWidth: 0, flex: 1 }}>
                          <Text strong ellipsis style={{ fontSize: 13, lineHeight: 1.35 }}>
                            {b.name}
                          </Text>
                          <Text type="secondary" ellipsis style={{ fontSize: 11, lineHeight: 1.3 }}>
                            {b.code}
                          </Text>
                        </Flex>
                      </Flex>
                    );
                  }}
                  labelRender={(props) => {
                    const b = visibleBranches.find((x) => x.id === props.value);
                    if (!b) {
                      return <span>{props.label}</span>;
                    }
                    return (
                      <Flex align="center" gap={8} style={{ minWidth: 0, width: "100%" }}>
                        <BranchAvatar branch={b} size={22} />
                        <Text
                          ellipsis
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            flex: 1,
                            minWidth: 0,
                            lineHeight: "32px"
                          }}
                        >
                          {b.name}
                        </Text>
                      </Flex>
                    );
                  }}
                  suffixIcon={
                    <DownOutlined style={{ fontSize: 11, color: token.colorTextSecondary, marginInlineStart: 2 }} />
                  }
                  popupMatchSelectWidth={false}
                  styles={{
                    root: {
                      flex: 1,
                      minWidth: 0,
                      height: 32
                    },
                    popup: {
                      root: {
                        border: "none",
                        borderWidth: 0,
                        minWidth: 260,
                        boxShadow: token.boxShadowSecondary,
                        borderRadius: token.borderRadiusLG,
                        padding: 4,
                        overflow: "hidden"
                      }
                    }
                  }}
                  classNames={{
                    popup: {
                      root: "appbar-branch-select-popup"
                    }
                  }}
                  style={{
                    width: "100%",
                    minWidth: 0
                  }}
                  listHeight={280}
                />
              </div>
            )}
          </Flex>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              lineHeight: "18px",
              display: "block",
              margin: 0,
              padding: 0
            }}
          >
            {workspaceLabel}
          </Text>
        </Flex>
      </Flex>

      <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
        <Space size={8}>
          <Button
            type="text"
            icon={<SettingOutlined />}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${token.colorBorder}`,
              backgroundColor: token.colorBgContainer
            }}
            onClick={() => {
              if (!canOpenSettings) {
                return;
              }
              if (pathname !== "/pages/settings") {
                confirmNavigation(() => router.push("/pages/settings"));
              }
            }}
            disabled={!canOpenSettings}
          />
          <Dropdown menu={{ items: profileMenuItems, onClick: onProfileMenuClick }} trigger={["click"]}>
            <Avatar
              size={36}
              src={session?.user?.profilePhoto || undefined}
              style={{ backgroundColor: token.colorPrimary, cursor: "pointer" }}
            >
              {initials || <UserOutlined />}
            </Avatar>
          </Dropdown>
        </Space>
      </Flex>

    </Header>
  );
}
