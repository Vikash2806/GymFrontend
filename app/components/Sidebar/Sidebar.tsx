"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu, theme, Button, Tooltip } from "antd";
import {
  HomeOutlined,
  FileTextOutlined,
  DollarOutlined,
  BarChartOutlined,
  AccountBookOutlined,
  UserOutlined,
  ProfileOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BankOutlined,
  DatabaseOutlined,
  TeamOutlined,
  ShopOutlined,
  CrownOutlined,
  CalculatorOutlined,
  MoneyCollectOutlined,
  CreditCardOutlined,
  AppstoreOutlined,
  HistoryOutlined,
  SafetyOutlined,
  EnvironmentOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  FundOutlined,
  WalletOutlined
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { startTransition } from "react";
import type { MenuProps } from "antd";
import { useAppSelector } from "@/redux/hooks";
import { selectSession } from "@/redux/features/auth/authSlice";
import { gymMembershipRoleFromSession } from "@/utils/gymRole";

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
  { key: "Billing", label: "Billing", icon: <MoneyCollectOutlined />, route: "/pages/billing" },
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

  

  { key: "Settings", label: "Settings", icon: <SettingOutlined />, route: "/pages/settings" }
];

const settingsMenuItems: MenuItem[] = [
  { key: "Back", label: "Settings", icon: <ArrowLeftOutlined /> },
  {
    key: "Organization",
    label: "Organization",
    icon: <ProfileOutlined />,
    children: [
      { key: "UserProfile", label: "User Profile", icon: <UserOutlined />, route: "/pages/settings/profile/user-profile" },
      { key: "CompanyDetails", label: "Company Details", icon: <BankOutlined />, route: "/pages/settings" },
      { key: "AllUsersRoles", label: "All Users/Roles", icon: <TeamOutlined />, route: "/pages/settings/profile/users-roles" },
      { key: "AccountActions", label: "Account Actions", icon: <SafetyOutlined />, route: "/pages/settings/profile/account-actions" },
      { key: "ManageSubscription", label: "Manage Subscription", icon: <CreditCardOutlined />, route: "/pages/settings/profile/subscription" },
      { key: "OpeningBalance", label: "Opening Balance", icon: <DatabaseOutlined />, route: "/pages/settings/profile/opening-balance" },
      { key: "YearEndClosing", label: "Year End Closing", icon: <SafetyCertificateOutlined />, route: "/pages/settings/profile/year-end" }
    ]
  },
  {
    key: "Master",
    label: "Master",
    icon: <SettingOutlined />,
    children: [
      { key: "AreaMaster", label: "Area Master", icon: <EnvironmentOutlined />, route: "/pages/settings/master/area-master" },
      { key: "GramPriceMaster", label: "Gram Price Master", icon: <DollarOutlined />, route: "/pages/settings/master/gram-master" },
      { key: "InterestSlabConfig", label: "Interest Slab Config", icon: <RiseOutlined />, route: "/pages/settings/master/interest-slab-config" },
      { key: "PrefixMaster", label: "Voucher Prefix Master", icon: <FileTextOutlined />, route: "/pages/settings/master/prefix-master" }
    ]
  }
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
          label: item.route ? (
            <Link href={item.route} prefetch style={{ display: "block", width: "100%" }}>
              {item.label}
            </Link>
          ) : (
            item.label
          )
        }
  );

export default function Sidebar({ appBarHeight, onCollapseChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { token } = theme.useToken();
  const session = useAppSelector(selectSession);

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [showSettingsOnly, setShowSettingsOnly] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const mainMenuItemsFiltered = useMemo(() => {
    const role = gymMembershipRoleFromSession(session);
    if (role === "staff") {
      return mainMenuItems.filter(
        (item) => item.key !== "StaffManager" && item.key !== "Branches"
      );
    }
    if (role === "manager") {
      return mainMenuItems.filter((item) => item.key !== "Branches");
    }
    return mainMenuItems;
  }, [session]);

  const routeMap = useMemo(() => {
    const map: Record<string, string> = {};
    flattenRoutes(mainMenuItemsFiltered, map);
    flattenRoutes(settingsMenuItems, map);
    return map;
  }, [mainMenuItemsFiltered]);

  useEffect(() => {
    const matched = Object.entries(routeMap).find(([, route]) => route === pathname);
    if (matched) {
      setSelectedKeys([matched[0]]);
    }
    if (pathname?.startsWith("/pages/settings")) {
      setShowSettingsOnly(true);
    }
  }, [pathname, routeMap]);

  const handleClick: MenuProps["onClick"] = (e) => {
    setSelectedKeys([e.key]);
    if (e.key === "Settings") {
      setShowSettingsOnly(true);
      if (pathname !== "/pages/settings") {
        startTransition(() => {
          router.push("/pages/settings");
        });
      }
      return;
    }
    if (e.key === "Back") {
      setShowSettingsOnly(false);
      if (pathname !== "/pages/dashboard") {
        startTransition(() => {
          router.push("/pages/dashboard");
        });
      }
      return;
    }
  };

  const toggleCollapse = () => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    onCollapseChange?.(nextCollapsed);
  };

  const menuData = showSettingsOnly ? toMenuData(settingsMenuItems) : toMenuData(mainMenuItemsFiltered);

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
