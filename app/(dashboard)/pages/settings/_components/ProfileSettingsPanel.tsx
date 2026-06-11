"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Divider, Form, Input, QRCode, Space, Typography } from "antd";
import { PrinterOutlined, UserOutlined } from "@ant-design/icons";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { selectSession, setSession } from "@/redux/features/auth/authSlice";
import apiClient from "@/utils/api";
import { buildBranchCheckInQrValue } from "@/utils/branchCheckInQr";
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

const SCREEN_QR_SIZE = 280;
const PRINT_QR_SIZE = 380;

const QR_INSTRUCTIONS = [
  "Print and display this QR at the branch entrance or reception.",
  "Members scan once to check in and again when leaving to check out.",
  "New members can scan this QR in the FitForge app to create an account and join this branch.",
  "Use Check-in in the mobile app for daily gym visits."
];

function buildPrintQrImage(sourceCanvas: HTMLCanvasElement | null, fallbackMarkup: string): string {
  if (sourceCanvas) {
    const printCanvas = document.createElement("canvas");
    printCanvas.width = PRINT_QR_SIZE;
    printCanvas.height = PRINT_QR_SIZE;
    const ctx = printCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, PRINT_QR_SIZE, PRINT_QR_SIZE);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceCanvas, 0, 0, PRINT_QR_SIZE, PRINT_QR_SIZE);
      return `<img src="${printCanvas.toDataURL("image/png")}" alt="Branch QR code" width="${PRINT_QR_SIZE}" height="${PRINT_QR_SIZE}" style="display:block" />`;
    }
  }

  if (fallbackMarkup.startsWith("data:")) {
    return `<img src="${fallbackMarkup}" alt="Branch QR code" width="${PRINT_QR_SIZE}" height="${PRINT_QR_SIZE}" style="display:block" />`;
  }

  return fallbackMarkup;
}

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
  const qrPrintRef = useRef<HTMLDivElement>(null);
  const { setDirty, clearDirty } = useUnsavedChanges();

  const gymId = session?.user?.defaults?.gymId ?? session?.gym?.id ?? "";
  const currentBranchId = session?.activeBranch?.id ?? session?.user?.defaults?.branchId ?? "";
  const currentBranchName =
    session?.activeBranch?.name ??
    session?.gym?.branches?.find((branch) => branch.id === currentBranchId)?.name ??
    "Your branch";
  const gymName = session?.gym?.name ?? "Your gym";

  const checkInQrValue = useMemo(() => {
    if (!gymId || !currentBranchId) {
      return "";
    }
    return buildBranchCheckInQrValue(gymId, currentBranchId);
  }, [gymId, currentBranchId]);

  const printCheckInQr = () => {
    if (!qrPrintRef.current || !checkInQrValue) {
      return;
    }

    const sourceCanvas = qrPrintRef.current.querySelector("canvas");
    const fallbackMarkup =
      sourceCanvas?.toDataURL("image/png") ??
      qrPrintRef.current.querySelector("svg")?.outerHTML ??
      "";
    const qrImage = buildPrintQrImage(sourceCanvas, fallbackMarkup);
    const instructionItems = QR_INSTRUCTIONS.map((line) => `<li>${line}</li>`).join("");

    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "style",
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    );
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      document.body.removeChild(iframe);
      message.error("Could not open print view.");
      return;
    }

    const cleanup = () => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    };

    frameWindow.onafterprint = cleanup;
    window.setTimeout(cleanup, 60_000);

    frameWindow.document.open();
    frameWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${gymName}</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        font-family: Arial, sans-serif;
        color: #111;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .wrap {
        max-width: 640px;
        margin: 0 auto;
        padding: 8px 0 0;
        text-align: center;
      }
      h1 { font-size: 26px; margin: 0 0 6px; font-weight: 700; }
      .subtitle { margin: 0 0 28px; font-size: 16px; color: #444; }
      .qr {
        margin: 0 auto 28px;
        display: inline-flex;
        padding: 16px;
        border: 2px solid #111;
        border-radius: 12px;
        background: #fff;
      }
      ul {
        text-align: left;
        margin: 0 auto;
        padding-left: 22px;
        max-width: 520px;
        font-size: 15px;
        line-height: 1.55;
      }
      li { margin-bottom: 10px; }
      li:last-child { margin-bottom: 0; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>${gymName}</h1>
      <p class="subtitle">${currentBranchName}</p>
      <div class="qr">${qrImage}</div>
      <ul>${instructionItems}</ul>
    </div>
  </body>
</html>`);
    frameWindow.document.close();
    frameWindow.focus();
    frameWindow.print();
  };

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

      <Divider />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          alignItems: "stretch",
          padding: "8px 0 4px"
        }}
      >
        <div
          ref={qrPrintRef}
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.06)",
            background: "#fafafa",
            minWidth: 320
          }}
        >
          {checkInQrValue ? (
            <QRCode
              key={currentBranchId}
              value={checkInQrValue}
              size={SCREEN_QR_SIZE}
              bordered={false}
              errorLevel="M"
              type="canvas"
              color="#000000"
              bgColor="#ffffff"
            />
          ) : (
            <Typography.Text type="secondary">Select a branch to generate QR.</Typography.Text>
          )}
          {checkInQrValue ? (
            <Typography.Text type="secondary" style={{ marginTop: 12, fontSize: 12, textAlign: "center" }}>
              {currentBranchName}
            </Typography.Text>
          ) : null}
        </div>

        <div
          style={{
            flex: "1 1 260px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            minHeight: 240
          }}
        >
          <div>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              Branch QR code
            </Typography.Title>
            <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
              Current branch: {currentBranchName}
            </Typography.Text>
            <Typography.Paragraph style={{ marginBottom: 8, color: "rgba(0,0,0,0.65)" }}>
              Print this code and display it at your branch. Members use the FitForge mobile app to
              check in and check out with one scan each.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 8, color: "rgba(0,0,0,0.65)" }}>
              New members can scan this same QR during sign-up to create an account and join this
              branch.
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0, color: "rgba(0,0,0,0.45)", fontSize: 13 }}>
              Active membership is required for check-in. One scan = one action (in or out).
            </Typography.Paragraph>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={printCheckInQr}
              disabled={!checkInQrValue}
            >
              Print QR
            </Button>
          </Space>
        </div>
      </div>
    </Card>
  );
}
