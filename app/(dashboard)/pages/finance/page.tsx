"use client";

import React from "react";
import { Card } from "antd";
import FinancialOverviewPanel from "./FinancialOverviewPanel";

export default function FinancePage() {
  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <FinancialOverviewPanel />
    </Card>
  );
}
