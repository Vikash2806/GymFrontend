"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Avatar, Button, Card, Form, Input, Space, Upload } from "antd";
import { DeleteOutlined, ShopOutlined, UploadOutlined, UserOutlined } from "@ant-design/icons";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES, hasFeature } from "@/utils/permissions";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession, setSession, updateGymInSession } from "@/redux/features/auth/authSlice";
import apiClient from "@/utils/api";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";
import { isValidIndianMobile, stripToIndianMobileDigits, toE164IndianMobile } from "@/utils/mobileValidation";
import { useSearchParams } from "next/navigation";

type ProfileFormValues = {
  fullName: string;
  mobileNumber: string;
  email?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

type GymFormValues = {
  gymName: string;
  supportPhone?: string;
};

type SettingsSectionKey = "profile" | "gym";

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
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const userFullName = session?.user?.fullName ?? "";
  const userPhone = stripToIndianMobileDigits(session?.user?.phone ?? "");
  const userEmail = session?.user?.email ?? "";
  const gymName = session?.gym?.name ?? "";
  const gymLogo = session?.gym?.logoUrl ?? null;
  const canEditProfile = hasFeature(session, FEATURES.SETTINGS);
  const canEditGymProfile = hasFeature(session, FEATURES.GYM_PROFILE);
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [gymForm] = Form.useForm<GymFormValues>();
  const [profileSaving, setProfileSaving] = useState(false);
  // undefined => unchanged, string => new/uploaded logo, null => explicitly remove logo
  const [logoFile, setLogoFile] = useState<string | null | undefined>(undefined);
  const [gymSaving, setGymSaving] = useState(false);
  const { setDirty, clearDirty } = useUnsavedChanges();

  const activeSection = (searchParams.get("tab") === "gym" ? "gym" : "profile") as SettingsSectionKey;
  const roleLabel = useMemo(() => {
    if (!session?.user?.defaults?.gymId || !session.user.associatedGyms) {
      return "Staff";
    }
    const currentMembership = session.user.associatedGyms.find((membership) => membership.gymId === session.user.defaults!.gymId);
    const role = currentMembership?.gymRole ?? "staff";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [session]);

  useEffect(() => {
    return () => {
      clearDirty("settings-profile-page");
      clearDirty("settings-page");
    };
  }, [clearDirty]);

  const saveGymProfile = async () => {
    if (!canEditGymProfile) {
      message.error("You do not have permission to update gym profile.");
      return;
    }
    const values = await gymForm.validateFields();
    setGymSaving(true);
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
      setGymSaving(false);
    }
  };

  const deleteGymProfilePicture = async () => {
    if (!canEditGymProfile) {
      message.error("You do not have permission to update gym profile.");
      return;
    }
    const currentGymName = String(gymForm.getFieldValue("gymName") ?? gymName).trim() || gymName;
    setGymSaving(true);
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
      setGymSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!canEditProfile) {
      message.error("You do not have permission to update profile.");
      return;
    }
    const values = await profileForm.validateFields();
    const mobileE164 = toE164IndianMobile(values.mobileNumber ?? "");
    if (!mobileE164 || !isValidIndianMobile(mobileE164)) {
      message.error("Please enter a valid mobile number.");
      return;
    }

    setProfileSaving(true);
    try {
      await apiClient.patch("/auth/profile", {
        fullName: values.fullName.trim(),
        mobileNumber: mobileE164,
        email: values.email?.trim() ? values.email.trim() : null,
        oldPassword: values.oldPassword?.trim() || undefined,
        newPassword: values.newPassword?.trim() || undefined
      });
      const me = await apiClient.get("/auth/me");
      dispatch(setSession(me.data));
      profileForm.setFieldsValue({
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      message.success("Profile updated.");
      clearDirty("settings-profile-page");
    } catch (error) {
      const errMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Could not update profile.";
      message.error(errMessage);
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <RbacPermissionGuard permission={FEATURES.SETTINGS}>
      {activeSection === "profile" ? (
        <Card title="Profile Settings">
            <Form
              key={`${userFullName}-${userPhone}-${userEmail}`}
              form={profileForm}
              layout="vertical"
              initialValues={{
                fullName: userFullName,
                mobileNumber: userPhone,
                email: userEmail || ""
              }}
              onValuesChange={() => {
                setDirty("settings-profile-page", true);
              }}
            >
              <Form.Item label="Role">
                <Input value={roleLabel} prefix={<UserOutlined />} disabled />
              </Form.Item>
              <Form.Item
                label="Name"
                name="fullName"
                rules={[
                  { required: true, message: "Name is required." },
                  { min: 2, message: "Name should be at least 2 characters." }
                ]}
              >
                <Input placeholder="Enter full name" disabled={!canEditProfile} />
              </Form.Item>
              <Form.Item
                label="Phone number"
                name="mobileNumber"
                getValueFromEvent={(event) => stripToIndianMobileDigits(event?.target?.value ?? "")}
                rules={[
                  { required: true, message: "Mobile number is required." },
                  {
                    validator: async (_, value: string) => {
                      if (!value || value.trim().length !== 10 || !isValidIndianMobile(value)) {
                        throw new Error("Enter a valid 10-digit Indian mobile number.");
                      }
                    }
                  }
                ]}
              >
                <Input
                  placeholder="Enter mobile number"
                  maxLength={10}
                  disabled={!canEditProfile}
                />
              </Form.Item>
              <Form.Item
                label="Email (optional)"
                name="email"
                rules={[{ type: "email", message: "Enter a valid email address." }]}
              >
                <Input placeholder="Enter email" disabled={!canEditProfile} />
              </Form.Item>
              <Form.Item
                label="Current password"
                name="oldPassword"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value) => {
                      if (getFieldValue("newPassword") && !value) {
                        throw new Error("Current password is required to set a new password.");
                      }
                    }
                  })
                ]}
              >
                <Input.Password placeholder="Enter current password" disabled={!canEditProfile} />
              </Form.Item>
              <Form.Item
                label="New password"
                name="newPassword"
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value: string) => {
                      if (getFieldValue("oldPassword") && !value) {
                        throw new Error("Please enter a new password.");
                      }
                      if (value && value.length < 6) {
                        throw new Error("New password must be at least 6 characters.");
                      }
                    }
                  })
                ]}
              >
                <Input.Password placeholder="Enter new password" disabled={!canEditProfile} />
              </Form.Item>
              <Form.Item
                label="Confirm new password"
                name="confirmPassword"
                dependencies={["newPassword"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value: string) => {
                      const nextPassword = getFieldValue("newPassword");
                      if (!nextPassword) {
                        return;
                      }
                      if (!value) {
                        throw new Error("Please confirm the new password.");
                      }
                      if (value !== nextPassword) {
                        throw new Error("Passwords do not match.");
                      }
                    }
                  })
                ]}
              >
                <Input.Password placeholder="Re-enter new password" disabled={!canEditProfile} />
              </Form.Item>
              <Space>
                <Button type="primary" loading={profileSaving} onClick={() => void saveProfile()} disabled={!canEditProfile}>
                  Save profile
                </Button>
              </Space>
            </Form>
        </Card>
      ) : (
        <Card title="Gym Settings">
            <Form
              key={gymName}
              form={gymForm}
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
                        loading={gymSaving}
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
                <Button
                  type="primary"
                  loading={gymSaving}
                  onClick={() => void saveGymProfile()}
                  disabled={!canEditGymProfile}
                >
                  Save changes
                </Button>
              </Space>
            </Form>
        </Card>
      )}
    </RbacPermissionGuard>
  );
}
