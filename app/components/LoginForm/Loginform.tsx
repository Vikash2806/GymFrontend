"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { loginAsync, selectIsLoggedIn, selectLoadingState } from "@/redux/features/auth/authSlice";
import type { AppDispatch } from "@/redux/store";
import { Form, Input, Button, Alert, Spin, Typography, Card } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";

const { Title } = Typography;

function LoginForm() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(selectLoadingState);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      router.push("/pages/dashboard");
    }
  }, [isLoggedIn, router]);

  const handleSubmit = async () => {
    try {
      const credentials = { username, password };
      const dispatchResult = await dispatch(loginAsync(credentials));

      if (dispatchResult.type === "users/login/rejected") {
        setError("Invalid Credentials");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <Card style={{ maxWidth: 420, margin: "80px auto", padding: 20 }}>
      <Title level={3} style={{ textAlign: "center" }}>
        Sign In
      </Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 15 }} />}
      <Form onFinish={handleSubmit}>
        <Form.Item>
          <Input
            size="large"
            placeholder="Username"
            prefix={<UserOutlined />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Form.Item>
        <Form.Item>
          <Input.Password
            size="large"
            placeholder="Password"
            prefix={<LockOutlined />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            visibilityToggle={{ visible: showPassword, onVisibleChange: setShowPassword }}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block disabled={isLoading}>
            {isLoading ? <Spin /> : "Sign In"}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default LoginForm;
