"use client";

import { Card, Form, Input, Button, Space, Switch } from "antd";

export default function SettingsPage() {
  return (
    <Card title="App Settings">
      <Form layout="vertical">
        <Form.Item label="Gym Name">
          <Input placeholder="Enter gym name" />
        </Form.Item>
        <Form.Item label="Notifications">
          <Switch defaultChecked />
        </Form.Item>
        <Space>
          <Button type="primary">Save</Button>
          <Button>Cancel</Button>
        </Space>
      </Form>
    </Card>
  );
}
