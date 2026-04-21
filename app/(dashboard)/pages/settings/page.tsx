"use client";

import { useState } from "react";
import { App, Avatar, Button, Card, Form, Input, Space, Switch, Upload } from "antd";
import { ShopOutlined, UploadOutlined } from "@ant-design/icons";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession, setSession, updateGymInSession } from "@/redux/features/auth/authSlice";
import apiClient from "@/utils/api";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const gymName = session?.gym?.name ?? "";
  const gymLogo = session?.gym?.logoUrl ?? null;
  const canEditGymProfile = hasFeature(session, FEATURES.GYM_PROFILE);
  const [form] = Form.useForm<{ gymName: string; supportPhone?: string }>();
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveGymProfile = async () => {
    if (!canEditGymProfile) {
      message.error("You do not have permission to update gym profile.");
      return;
    }
    const values = await form.validateFields();
    setSaving(true);
    try {
      const nextLogo = logoFile ?? gymLogo ?? null;
      await apiClient.patch("/gym/me", {
        name: values.gymName,
        logoUrl: nextLogo
      });
      dispatch(updateGymInSession({ name: values.gymName, logoUrl: nextLogo }));
      const me = await apiClient.get("/auth/me");
      dispatch(setSession(me.data));
      message.success("Gym profile updated.");
    } catch {
      message.error("Could not update gym profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RbacPermissionGuard permission={FEATURES.SETTINGS}>
      <Card title="Gym Settings">
        <Form key={gymName} form={form} layout="vertical" initialValues={{ gymName }}>
          <Form.Item label="Gym name" name="gymName">
            <Input placeholder="Enter gym name" disabled={!canEditGymProfile} />
          </Form.Item>
          <Form.Item label="Gym profile picture">
            <Space direction="vertical" size={10}>
              <Avatar
                shape="square"
                size={72}
                src={logoFile ?? gymLogo ?? undefined}
                style={{ backgroundColor: "#1677ff" }}
                icon={<ShopOutlined />}
              />
              <Upload
                accept="image/*"
                maxCount={1}
                showUploadList={false}
                disabled={!canEditGymProfile}
                beforeUpload={async (file) => {
                  try {
                    const dataUrl = await readFileAsDataUrl(file);
                    setLogoFile(dataUrl);
                  } catch {
                    message.error("Could not read file.");
                  }
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} disabled={!canEditGymProfile}>
                  Upload profile picture
                </Button>
              </Upload>
            </Space>
          </Form.Item>
          <Form.Item label="Support phone">
            <Input placeholder="Enter support mobile number" />
          </Form.Item>
          <Form.Item label="Enable renewal reminders">
            <Switch defaultChecked />
          </Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={() => void saveGymProfile()} disabled={!canEditGymProfile}>
              Save changes
            </Button>
            <Button onClick={() => form.resetFields()}>Reset</Button>
          </Space>
        </Form>
      </Card>
    </RbacPermissionGuard>
  );
}
