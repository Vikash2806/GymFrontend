"use client";

import React from "react";
import { Card } from "antd";
import BillingPanel from "./BillingPanel";

export default function BillingPage() {
  return (
    <Card styles={{ body: { paddingTop: 16 } }}>
      <BillingPanel />
    </Card>
  );
}
