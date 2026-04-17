"use client";

import { Typography } from "antd";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <Typography.Title level={2}>Gym App Starter</Typography.Title>
      <Typography.Paragraph>
        Baseline structure is ready with Next.js App Router, Ant Design, and
        Redux Toolkit.
      </Typography.Paragraph>
    </main>
  );
}
