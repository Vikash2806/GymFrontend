"use client";

import { Card, Form, Input, Button, Space, Switch } from "antd";
import RbacPermissionGuard from "@/app/components/Auth/RbacPermissionGuard";
import { FEATURES } from "@/utils/permissions";

export default function SettingsPage() {
  return (
    <RbacPermissionGuard permission={FEATURES.SETTINGS}>
      <Card title="Gym Settings">
        <Form layout="vertical">
          <Form.Item label="Gym name">
            <Input placeholder="Enter gym name" />
          </Form.Item>
          <Form.Item label="Support phone">
            <Input placeholder="Enter support mobile number" />
          </Form.Item>
          <Form.Item label="Enable renewal reminders">
            <Switch defaultChecked />
          </Form.Item>
          <Space>
            <Button type="primary">Save changes</Button>
            <Button>Reset</Button>
          </Space>
        </Form>
      </Card>
    </RbacPermissionGuard>
  );
}
