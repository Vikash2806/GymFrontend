"use client";

import { useEffect, useState } from "react";
import { App, Avatar, Button, Card, Form, Input, Space, Upload } from "antd";
import { DeleteOutlined, ShopOutlined, UploadOutlined } from "@ant-design/icons";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession, setSession, updateGymInSession } from "@/redux/features/auth/authSlice";
import apiClient from "@/utils/api";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";

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
  // undefined => unchanged, string => new/uploaded logo, null => explicitly remove logo
  const [logoFile, setLogoFile] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const { setDirty, clearDirty } = useUnsavedChanges();

  useEffect(() => {
    return () => {
      clearDirty("settings-page");
    };
  }, [clearDirty]);

  const saveGymProfile = async () => {
    if (!canEditGymProfile) {
      message.error("You do not have permission to update gym profile.");
      return;
    }
    const values = await form.validateFields();
    setSaving(true);
    try {
      const nextLogo = logoFile === undefined ? (gymLogo ?? null) : logoFile;
      await apiClient.patch("/gym/me", {
        name: values.gymName,
        logoUrl: nextLogo
      });
      dispatch(updateGymInSession({ name: values.gymName, logoUrl: nextLogo }));
      const me = await apiClient.get("/auth/me");
      dispatch(setSession(me.data));
      message.success("Gym profile updated.");
      clearDirty("settings-page");
    } catch {
      message.error("Could not update gym profile.");
    } finally {
      setSaving(false);
    }
  };

  const deleteGymProfilePicture = async () => {
    if (!canEditGymProfile) {
      message.error("You do not have permission to update gym profile.");
      return;
    }
    const currentGymName = String(form.getFieldValue("gymName") ?? gymName).trim() || gymName;
    setSaving(true);
    try {
      await apiClient.patch("/gym/me", {
        name: currentGymName,
        logoUrl: null
      });
      dispatch(updateGymInSession({ name: currentGymName, logoUrl: null }));
      const me = await apiClient.get("/auth/me");
      dispatch(setSession(me.data));
      setLogoFile(undefined);
      message.success("Gym profile picture deleted.");
      clearDirty("settings-page");
    } catch {
      message.error("Could not delete gym profile picture.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RbacPermissionGuard permission={FEATURES.SETTINGS}>
      <Card title="Gym Settings">
        <Form
          key={gymName}
          form={form}
          layout="vertical"
          initialValues={{ gymName, supportPhone: "" }}
          onValuesChange={() => {
            setDirty("settings-page", true);
          }}
        >
          <Form.Item label="Gym name" name="gymName">
            <Input placeholder="Enter gym name" disabled={!canEditGymProfile} />
          </Form.Item>
          <Form.Item label="Gym profile picture">
            <Space direction="vertical" size={10}>
              <Avatar
                shape="square"
                size={72}
                src={(logoFile === undefined ? gymLogo : logoFile) ?? undefined}
                style={{ backgroundColor: "#1677ff" }}
                icon={<ShopOutlined />}
              />
              <Space>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  disabled={!canEditGymProfile}
                  beforeUpload={async (file) => {
                    try {
                      const dataUrl = await readFileAsDataUrl(file);
                      setLogoFile(dataUrl);
                      setDirty("settings-page", true);
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
                {((logoFile === undefined ? gymLogo : logoFile) ?? null) ? (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={saving}
                    disabled={!canEditGymProfile}
                    onClick={() => void deleteGymProfilePicture()}
                  >
                    Delete picture
                  </Button>
                ) : null}
              </Space>
            </Space>
          </Form.Item>
          <Form.Item label="Support phone" name="supportPhone">
            <Input placeholder="Enter support mobile number" />
          </Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={() => void saveGymProfile()} disabled={!canEditGymProfile}>
              Save changes
            </Button>
          </Space>
        </Form>
      </Card>
    </RbacPermissionGuard>
  );
}
