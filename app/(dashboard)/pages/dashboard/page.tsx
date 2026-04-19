"use client";

import React from "react";
import { Card } from "antd";
import DashboardPanel from "./DashboardPanel";

export default function DashboardPage() {
  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <DashboardPanel />
    </Card>
  );
}
