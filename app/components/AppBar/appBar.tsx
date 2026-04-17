"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Layout,
  Typography,
  Input,
  Avatar,
  Button,
  Space,
  Dropdown,
  theme,
  type MenuProps
} from "antd";
import {
  SearchOutlined,
  DownOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import Image from "next/image";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { logoutAsync, selectUser } from "@/redux/features/auth/authSlice";
import { useRouter } from "next/navigation";

const { Header } = Layout;
const { Text } = Typography;

interface CustomAppBarProps {
  onHeightChange: (height: number) => void;
}

const searchCategories: MenuProps["items"] = [
  { key: "Customers", label: "Customers" },
  { key: "Employees", label: "Employees" },
  { key: "Vendors", label: "Vendors" },
  { key: "Pay and Close", label: "Pay and Close" },
  { key: "Pay Advance", label: "Pay Advance" },
  { key: "Transfer Pledge", label: "Transfer Pledge" }
];

export default function CustomAppBar({ onHeightChange }: CustomAppBarProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("Customers");
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (headerRef.current) {
      onHeightChange(headerRef.current.clientHeight);
    }
  }, [onHeightChange]);

  const handleSearch = () => {
    if (selectedCategory === "Customers") {
      router.push("/pages/customers");
      return;
    }
    if (selectedCategory === "Employees") {
      router.push("/pages/employees");
      return;
    }
    if (selectedCategory === "Vendors") {
      router.push("/pages/vendors");
      return;
    }
    router.push("/pages/dashboard");
  };

  const onProfileMenuClick: MenuProps["onClick"] = async ({ key }) => {
    if (key === "settings") {
      router.push("/pages/settings");
      return;
    }
    if (key === "logout") {
      await dispatch(logoutAsync());
      router.push("/login");
    }
  };

  const profileMenuItems: MenuProps["items"] = [
    { key: "settings", label: "Settings", icon: <SettingOutlined /> },
    { key: "logout", label: "Logout", icon: <LogoutOutlined /> }
  ];

  return (
    <Header
      ref={headerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: token.colorBgElevated,
        height: "64px",
        padding: "0 16px",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${token.colorBorder}`
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Image src="/assets/logo.webp" alt="Company Logo" width={38} height={38} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: "#1677ff", lineHeight: "20px" }}>
            SmartBookz ERP
          </Text>
          <Text
            italic
            style={{ fontSize: 12, color: "rgba(0, 0, 0, 0.65)", lineHeight: "20px" }}
          >
            by CodingRoof
          </Text>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: "5px",
            border: "1px solid #d9d9d9",
            overflow: "hidden"
          }}
        >
          <Dropdown
            menu={{
              items: searchCategories,
              onClick: ({ key }) => setSelectedCategory(key)
            }}
            trigger={["click"]}
          >
            <Button style={{ border: "none", height: "38px" }}>
              <Text style={{ fontSize: 13, color: "rgba(0,0,0,0.45)" }}>{selectedCategory}</Text>
              <DownOutlined />
            </Button>
          </Dropdown>
          <Input
            placeholder="Search..."
            style={{ width: 220, height: "38px", border: "none" }}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            style={{ height: "38px", width: "38px", borderRadius: 0, border: "none" }}
            onClick={handleSearch}
          />
        </div>

        <Space size={8}>
          <Button
            type="text"
            icon={<SettingOutlined />}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              border: "1px solid #d9d9d9",
              backgroundColor: "#ffffff"
            }}
            onClick={() => router.push("/pages/settings")}
          />
          <Dropdown menu={{ items: profileMenuItems, onClick: onProfileMenuClick }} trigger={["click"]}>
            <Avatar
              size={38}
              style={{ backgroundColor: "#1677ff", cursor: "pointer" }}
              icon={!user?.username ? <UserOutlined /> : undefined}
            >
              {user?.username?.slice(0, 2).toUpperCase()}
            </Avatar>
          </Dropdown>
        </Space>
      </div>
    </Header>
  );
}
