"use client";

import { LockOutlined, MobileOutlined } from "@ant-design/icons";
import { Button, Col, Form, Input, Row, Space, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loginAsync,
  selectIsLoggedIn,
  selectLoadingState,
  selectSession
} from "@/redux/features/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import { normalizeIndianMobileNumber, stripToIndianMobileDigits } from "@/utils/mobileValidation";
import { getFirstAccessibleRoute } from "@/utils/permissions";
import styles from "./auth.module.css";

const { Title, Text } = Typography;

type SignInFormValues = {
  mobileNumber: string;
  password: string;
};

export default function SignInCard() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const isLoading = useSelector(selectLoadingState);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const session = useSelector(selectSession);
  const [form] = Form.useForm<SignInFormValues>();

  useEffect(() => {
    if (isLoggedIn) {
      router.replace(getFirstAccessibleRoute(session));
    }
  }, [isLoggedIn, router, session]);

  const onFinish = async (values: SignInFormValues) => {
    const normalized = normalizeIndianMobileNumber(values.mobileNumber);
    if (!normalized) {
      form.setFields([
        {
          name: "mobileNumber",
          errors: ["Please enter a valid 10-digit Indian mobile number."]
        }
      ]);
      return;
    }

    const result = await dispatch(
      loginAsync({
        mobileNumber: normalized,
        password: values.password
      })
    );

    if (loginAsync.rejected.match(result) && result.payload) {
      form.setFields([{ name: "password", errors: [String(result.payload)] }]);
    }
  };

  return (
    <div className={styles.authCard}>
      <Title level={2} className={styles.cardTitle}>
        Welcome Back
      </Title>
      <Text className={styles.cardDescription}>Log in to your FitForge admin dashboard.</Text>

      <Form<SignInFormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        className={styles.authForm}
        onFinish={onFinish}
        autoComplete="on"
      >
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
          label="Password"
          name="password"
          rules={[{ required: true, message: "Enter your password." }]}
        >
          <Input.Password
            size="large"
            placeholder="Enter your password"
            prefix={<LockOutlined className={styles.inputIcon} />}
            autoComplete="current-password"
          />
        </Form.Item>

        <Row justify="space-between" align="middle" className={styles.helperRowAnt}>
          <Col>
            <Link href="#" className={styles.helperLink}>
              Forgot Password?
            </Link>
          </Col>
          <Col>
            <Text type="secondary" className={styles.helperMuted}>
              Secure sign in
            </Text>
          </Col>
        </Row>

        <Form.Item className={styles.submitItem}>
          <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
            Login
          </Button>
        </Form.Item>
      </Form>

      <Space direction="vertical" size={4} className={styles.switchWrap}>
        <Text type="secondary" className={styles.switchText}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className={styles.helperLink}>
            Sign up
          </Link>
        </Text>
      </Space>
    </div>
  );
}
