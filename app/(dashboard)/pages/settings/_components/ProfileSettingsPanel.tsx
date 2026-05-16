"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Card, Form, Input, Space } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession, setSession } from "@/redux/features/auth/authSlice";
import apiClient from "@/utils/api";
import { useUnsavedChanges } from "@/contexts/UnsavedChangesContext";
import { isValidIndianMobile, stripToIndianMobileDigits, toE164IndianMobile } from "@/utils/mobileValidation";
import { FEATURES, hasFeature } from "@/utils/permissions";

type ProfileFormValues = {
  fullName: string;
  mobileNumber: string;
  email?: string;
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export default function ProfileSettingsPanel() {
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const userFullName = session?.user?.fullName ?? "";
  const userPhone = stripToIndianMobileDigits(session?.user?.phone ?? "");
  const userEmail = session?.user?.email ?? "";
  const canEditProfile = hasFeature(session, FEATURES.SETTINGS);
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [profileSaving, setProfileSaving] = useState(false);
  const { setDirty, clearDirty } = useUnsavedChanges();

  const roleLabel = useMemo(() => {
    if (!session?.user?.defaults?.gymId || !session.user.associatedGyms) {
      return "Staff";
    }
    const currentMembership = session.user.associatedGyms.find(
      (membership) => membership.gymId === session.user.defaults!.gymId
    );
    const role = currentMembership?.gymRole ?? "staff";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [session]);

  useEffect(() => {
    return () => {
      clearDirty("settings-profile-page");
    };
  }, [clearDirty]);

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
          <Input placeholder="Enter mobile number" maxLength={10} disabled={!canEditProfile} />
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
          <Button
            type="primary"
            loading={profileSaving}
            onClick={() => void saveProfile()}
            disabled={!canEditProfile}
          >
            Save profile
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
