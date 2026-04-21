"use client";

import {
  LockOutlined,
  MailOutlined,
  MobileOutlined,
  ShopOutlined,
  UploadOutlined,
  UserOutlined
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import {
  Button,
  Col,
  Form,
  Input,
  Row,
  Space,
  Steps,
  Typography,
  Upload,
  theme
} from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectIsLoggedIn, selectLoadingState, signupAsync } from "@/redux/features/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import { normalizeIndianMobileNumber, stripToIndianMobileDigits } from "@/utils/mobileValidation";
import styles from "./auth.module.css";

const { Title, Text } = Typography;

type AccountStepValues = {
  firstName: string;
  lastName?: string;
  mobileNumber: string;
  recoveryEmail?: string;
  password: string;
};

type GymStepValues = {
  gymName: string;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SignUpCard() {
  const { token } = theme.useToken();
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const isLoading = useSelector(selectLoadingState);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const [accountForm] = Form.useForm<AccountStepValues>();
  const [gymForm] = Form.useForm<GymStepValues>();
  const [step, setStep] = useState(0);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountStepValues | null>(null);
  const [gymLogo, setGymLogo] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (isLoggedIn) {
      router.replace("/pages/dashboard");
    }
  }, [isLoggedIn, router]);

  const onAccountFinish = (values: AccountStepValues) => {
    setAccountSnapshot(values);
    setStep(1);
  };

  const onGymFinish = async (values: GymStepValues) => {
    if (!accountSnapshot) {
      return;
    }
    const normalized = normalizeIndianMobileNumber(accountSnapshot.mobileNumber);
    if (!normalized) {
      setStep(0);
      accountForm.setFields([
        { name: "mobileNumber", errors: ["Please enter a valid 10-digit Indian mobile number."] }
      ]);
      return;
    }

    const result = await dispatch(
      signupAsync({
        firstName: accountSnapshot.firstName,
        lastName: accountSnapshot.lastName?.trim() ?? "",
        mobileNumber: normalized,
        recoveryEmail: accountSnapshot.recoveryEmail?.trim() ?? "",
        password: accountSnapshot.password,
        gymName: values.gymName.trim(),
        gymLogo
      })
    );

    if (signupAsync.rejected.match(result) && result.payload) {
      gymForm.setFields([{ name: "gymName", errors: [String(result.payload)] }]);
    }
  };

  return (
    <div className={styles.authCard}>
      <Title level={2} className={styles.cardTitle}>
        Create Your Account
      </Title>
      <Text className={styles.cardDescription}>
        Start your 14-day free trial. Set up your gym in minutes.
      </Text>

      <Steps
        current={step}
        className={styles.signupSteps}
        items={[
          { title: "Account details" },
          { title: "Gym configuration" }
        ]}
      />

      {step === 0 && (
        <Form<AccountStepValues>
          form={accountForm}
          layout="vertical"
          requiredMark={false}
          className={styles.authForm}
          onFinish={onAccountFinish}
          autoComplete="on"
        >
          <Text className={styles.sectionLabel}>Account details</Text>

          <Row gutter={[12, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="First name"
                name="firstName"
                rules={[{ required: true, message: "Enter your first name." }]}
              >
                <Input
                  size="large"
                  placeholder="First name"
                  prefix={<UserOutlined className={styles.inputIcon} />}
                  autoComplete="given-name"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Last name"
                name="lastName"
              >
                <Input
                  size="large"
                  placeholder="Last name"
                  prefix={<UserOutlined className={styles.inputIcon} />}
                  autoComplete="family-name"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Mobile number">
            <Space.Compact block className={styles.mobileCompact}>
              <Input
                className={styles.mobilePrefix}
                readOnly
                tabIndex={-1}
                value="+91"
                aria-label="Country code India"
              />
              <Form.Item
                name="mobileNumber"
                noStyle
                normalize={stripToIndianMobileDigits}
                rules={[
                  { required: true, message: "Enter your mobile number." },
                  {
                    validator: (_, value) => {
                      if (!value || !normalizeIndianMobileNumber(String(value))) {
                        return Promise.reject(new Error("Enter a valid 10-digit Indian mobile number."));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input
                  size="large"
                  className={styles.mobileInputMain}
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="Enter 10 Digit Mobile Number"
                  prefix={<MobileOutlined className={styles.inputIcon} />}
                  autoComplete="tel-national"
                />
              </Form.Item>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            label="Recovery email (optional)"
            name="recoveryEmail"
            rules={[
              {
                validator: (_, value) => {
                  const v = String(value ?? "").trim();
                  if (!v) {
                    return Promise.resolve();
                  }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                    return Promise.reject(new Error("Enter a valid email address."));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input
              size="large"
              type="email"
              placeholder="For password reset notifications"
              prefix={<MailOutlined className={styles.inputIcon} />}
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              { required: true, message: "Create a password." },
              { min: 6, message: "Password must be at least 6 characters." }
            ]}
          >
            <Input.Password
              size="large"
              placeholder="Create a password"
              prefix={<LockOutlined className={styles.inputIcon} />}
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item className={styles.submitItem}>
            <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
              Continue
            </Button>
          </Form.Item>
        </Form>
      )}

      {step === 1 && (
        <Form<GymStepValues>
          form={gymForm}
          layout="vertical"
          requiredMark={false}
          className={styles.authForm}
          onFinish={onGymFinish}
        >
          <Text className={styles.sectionLabel}>Gym configuration</Text>

          <Form.Item
            label="Gym name"
            name="gymName"
            rules={[{ required: true, message: "Enter your gym name." }]}
          >
            <Input
              size="large"
              placeholder="Gym name"
              prefix={<ShopOutlined className={styles.inputIcon} />}
            />
          </Form.Item>

          <Form.Item label="Gym logo (optional)">
            <Upload
              accept="image/*"
              maxCount={1}
              fileList={fileList}
              beforeUpload={async (file) => {
                try {
                  const dataUrl = await readFileAsDataUrl(file);
                  setGymLogo(dataUrl);
                  setFileList([
                    {
                      uid: file.uid,
                      name: file.name,
                      status: "done",
                      url: dataUrl
                    }
                  ]);
                } catch {
                  setGymLogo(null);
                  setFileList([]);
                }
                return false;
              }}
              onRemove={() => {
                setGymLogo(null);
                setFileList([]);
              }}
            >
              <Button icon={<UploadOutlined />} size="large" style={{ color: token.colorText }}>
                Upload logo
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item className={styles.submitItem}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                Create account
              </Button>
              <Button block size="large" onClick={() => setStep(0)}>
                Back
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}

      <Space direction="vertical" size={4} className={styles.switchWrap}>
        <Text type="secondary" className={styles.switchText}>
          Already have an account?{" "}
          <Link href="/login" className={styles.helperLink}>
            Sign in
          </Link>
        </Text>
      </Space>
    </div>
  );
}
