"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu, theme, Button, Tooltip } from "antd";
import {
  HomeOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BankOutlined,
  TeamOutlined,
  MoneyCollectOutlined,
  UserAddOutlined,
  FundOutlined,
  WalletOutlined,
  SwapOutlined
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

const { Sider } = Layout;

interface SidebarProps {
  appBarHeight: number;
  onCollapseChange?: (collapsed: boolean) => void;
}

interface MenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  route?: string;
  children?: MenuItem[];
}

const mainMenuItems: MenuItem[] = [
  { key: "Dashboard", label: "Dashboard", icon: <HomeOutlined />, route: "/pages/dashboard" },
  { key: "Branches", label: "Branches", icon: <BankOutlined />, route: "/pages/branches" },
  { key: "GymMembers", label: "Members", icon: <TeamOutlined />, route: "/pages/members" },
  { key: "Billing", label: "Overdue Payments", icon: <MoneyCollectOutlined />, route: "/pages/billing" },
  { key: "Transactions", label: "Transactions", icon: <SwapOutlined />, route: "/pages/transactions" },
  {
    key: "Finance",
    label: "Financial Overview",
    icon: <FundOutlined />,
    route: "/pages/finance"
  },
  { key: "Expenses", label: "Expenses", icon: <WalletOutlined />, route: "/pages/expenses" },
  {
    key: "StaffManager",
    label: "Staff/Manager",
    icon: <UserAddOutlined />,
    route: "/pages/staff-manager"
  },
  { key: "RbacAdmin", label: "Role Master", icon: <SettingOutlined />, route: "/admin/rbac" },

  { key: "Settings", label: "Settings", icon: <SettingOutlined />, route: "/pages/settings" }
];

const flattenRoutes = (items: MenuItem[], map: Record<string, string>) => {
  items.forEach((item) => {
    if (item.route) {
      map[item.key] = item.route;
    }
    if (item.children) {
      flattenRoutes(item.children, map);
    }
  });
};

const toMenuData = (items: MenuItem[]): NonNullable<MenuProps["items"]> =>
  items.map((item) =>
    item.children
      ? { key: item.key, icon: item.icon, label: item.label, children: toMenuData(item.children) }
      : {
          key: item.key,
          icon: item.icon,
          label: item.label
        }
  );

export default function Sidebar({ appBarHeight, onCollapseChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const { confirmNavigation } = useUnsavedChanges();
  const session = useAppSelector(selectSession);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const mainMenuItemsFiltered = useMemo(() => {
    return mainMenuItems.filter((item) => {
      if (item.key === "Dashboard") {
        return hasFeature(session, FEATURES.DASHBOARD);
      }
      if (item.key === "StaffManager") {
        return hasFeature(session, FEATURES.STAFF_MANAGEMENT);
      }
      if (item.key === "Branches") {
        return hasFeature(session, FEATURES.BRANCH_MANAGEMENT);
      }
      if (item.key === "GymMembers") {
        return hasFeature(session, FEATURES.MEMBER_MANAGEMENT);
      }
      if (item.key === "Billing") {
        return hasFeature(session, FEATURES.BILLING_DASHBOARD);
      }
      if (item.key === "Transactions") {
        return hasFeature(session, FEATURES.BILLING_DASHBOARD);
      }
      if (item.key === "Finance") {
        return hasFeature(session, FEATURES.FINANCIAL_OVERVIEW);
      }
      if (item.key === "RbacAdmin") {
        return hasFeature(session, FEATURES.RBAC_SETTINGS);
      }
      if (item.key === "Expenses") {
        return hasFeature(session, FEATURES.EXPENSES);
      }
      if (item.key === "Settings") {
        return hasFeature(session, FEATURES.SETTINGS);
      }
      return true;
    });
  }, [session]);

  const routeMap = useMemo(() => {
    const map: Record<string, string> = {};
    flattenRoutes(mainMenuItemsFiltered, map);
    return map;
  }, [mainMenuItemsFiltered]);

  useEffect(() => {
    const matched = Object.entries(routeMap).find(([, route]) => route === pathname);
    if (matched) {
      setSelectedKeys([matched[0]]);
    }
  }, [pathname, routeMap]);

  const handleClick: MenuProps["onClick"] = (e) => {
    setSelectedKeys([e.key]);
    const targetRoute = routeMap[e.key];
    if (!targetRoute || pathname === targetRoute) {
      return;
    }
    confirmNavigation(() => router.push(targetRoute));
  };

  const toggleCollapse = () => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    onCollapseChange?.(nextCollapsed);
  };

  const menuData = toMenuData(mainMenuItemsFiltered);

  return (
    <Sider
      width={collapsed ? 80 : 240}
      collapsed={collapsed}
      style={{
        position: "fixed",
        top: appBarHeight,
        bottom: 0,
        borderRight: `1px solid ${token.colorBorder}`,
        background: token.colorBgContainer,
        overflowY: "auto",
        overflowX: "hidden",
        transition: "width 0.3s ease"
      }}
    >
      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={(keys) => setOpenKeys(keys)}
        onClick={handleClick}
        style={{ height: "calc(100% - 80px)", borderRight: 0, background: token.colorBgContainer }}
        items={menuData}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px",
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorder}`
        }}
      >
        <Tooltip title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"} placement="right">
          <Button
            type="text"
            icon={collapsed ? <ArrowRightOutlined /> : <ArrowLeftOutlined />}
            onClick={toggleCollapse}
            style={{ width: "100%", height: "48px" }}
          />
        </Tooltip>
      </div>
    </Sider>
  );
}
