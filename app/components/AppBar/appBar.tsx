"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  App,
  Layout,
  Typography,
  Input,
  Avatar,
  Button,
  Space,
  Dropdown,
  theme,
  type MenuProps,
  Select,
  Modal,
  Form,
  Upload,
  Flex
} from "antd";
import {
  SearchOutlined,
  DownOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  UploadOutlined,
  ShopOutlined
} from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import {
  logoutAsync,
  patchSessionToken,
  selectSession,
  setSession,
  updateGymInSession
} from "@/redux/features/auth/authSlice";
import { useRouter } from "next/navigation";
import apiClient from "@/utils/api";
import { WIDE_MODAL_WIDTH } from "@/utils/modalWidths";
import type { SessionGymBranch, SessionPayload } from "@/redux/features/auth/sessionTypes";

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

const searchCategories: MenuProps["items"] = [
  { key: "Customers", label: "Customers" },
  { key: "Employees", label: "Employees" },
  { key: "Vendors", label: "Vendors" },
  { key: "Pay and Close", label: "Pay and Close" },
  { key: "Pay Advance", label: "Pay Advance" },
  { key: "Transfer Pledge", label: "Transfer Pledge" }
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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

  const [selectedCategory, setSelectedCategory] = useState("Customers");
  const [searchValue, setSearchValue] = useState("");
  const [gymModalOpen, setGymModalOpen] = useState(false);
  const [gymForm] = Form.useForm<{ name: string }>();
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [savingGym, setSavingGym] = useState(false);

  const gym = session?.gym;
  const activeBranch = session?.activeBranch;
  const branches = gym?.branches ?? [];

  useEffect(() => {
    if (headerRef.current) {
      onHeightChange(headerRef.current.clientHeight);
    }
  }, [onHeightChange]);

  useEffect(() => {
    if (gymModalOpen && gym) {
      gymForm.setFieldsValue({ name: gym.name });
      setLogoFile(null);
    }
  }, [gymModalOpen, gym, gymForm]);

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

  const displayName = gym?.name ?? "FitForge";
  const initials =
    session?.user?.fullName
      ?.split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  const onBranchChange = async (branchId: string) => {
    try {
      const res = await apiClient.patch<{ token: string }>("/auth/branch", { branchId });
      dispatch(patchSessionToken({ token: res.data.token }));
      await refreshSession(dispatch);
    } catch {
      message.error("Could not switch branch.");
    }
  };

  const saveGym = async () => {
    const values = await gymForm.validateFields();
    setSavingGym(true);
    try {
      const nextLogo = logoFile ?? gym?.logoUrl ?? null;
      await apiClient.patch("/gym/me", {
        name: values.name,
        logoUrl: nextLogo
      });
      dispatch(updateGymInSession({ name: values.name, logoUrl: nextLogo }));
      await refreshSession(dispatch);
      message.success("Gym updated");
      setGymModalOpen(false);
    } catch {
      message.error("Could not update gym.");
    } finally {
      setSavingGym(false);
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
              onClick={() => gym && setGymModalOpen(true)}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: token.colorPrimary,
                cursor: gym ? "pointer" : "default",
                lineHeight: "24px",
                flex: "0 1 auto",
                maxWidth: 220
              }}
            >
              {displayName}
            </Text>
            {branches.length > 0 && (
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
                  value={activeBranch?.id}
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                  onChange={onBranchChange}
                  optionRender={(opt) => {
                    const b = branches.find((x) => x.id === opt.value);
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
                    const b = branches.find((x) => x.id === props.value);
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
            {gym ? "Gym owner workspace" : "by CodingRoof"}
          </Text>
        </Flex>
      </Flex>

      <Flex align="center" gap={12} style={{ flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: token.colorBgContainer,
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
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
            <Button type="text" style={{ height: 36 }}>
              <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>{selectedCategory}</Text>
              <DownOutlined />
            </Button>
          </Dropdown>
          <Input
            placeholder="Search..."
            style={{ width: 200, height: 36, border: "none" }}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            style={{ height: 36, width: 36, borderRadius: 0, border: "none" }}
            onClick={handleSearch}
          />
        </div>

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
            onClick={() => router.push("/pages/settings")}
          />
          <Dropdown menu={{ items: profileMenuItems, onClick: onProfileMenuClick }} trigger={["click"]}>
            <Avatar size={36} style={{ backgroundColor: token.colorPrimary, cursor: "pointer" }}>
              {initials || <UserOutlined />}
            </Avatar>
          </Dropdown>
        </Space>
      </Flex>

      <Modal
        title="Edit gym"
        open={gymModalOpen}
        onOk={saveGym}
        onCancel={() => setGymModalOpen(false)}
        confirmLoading={savingGym}
        destroyOnHidden
        width={WIDE_MODAL_WIDTH}
      >
        <Form form={gymForm} layout="vertical">
          <Form.Item name="name" label="Gym name" rules={[{ required: true, message: "Enter gym name" }]}>
            <Input prefix={<ShopOutlined />} />
          </Form.Item>
          <Form.Item label="Logo">
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={async (file) => {
                try {
                  const dataUrl = await readFileAsDataUrl(file);
                  setLogoFile(dataUrl);
                } catch {
                  message.error("Could not read file");
                }
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Upload new logo</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Header>
  );
}
